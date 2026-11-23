import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import type { Queryable } from '../legal/types.js'
import { getWebAccountPremium, grantWebEntitlement } from './webAccounts.js'
import {
  WEB_DEVICE_LIMIT,
  countActiveDevices,
  registerDeviceFromChallengeHash,
  registerOrReuseDevice,
  revokeDeviceById,
  revokeDeviceByTokenHash,
  hashDeviceToken,
  mintDeviceToken,
} from './webTelegramDevices.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(here, '../..')
function readSql(relativePath: string): string {
  return fs.readFileSync(path.join(serverRoot, relativePath), 'utf8')
}
async function createHarness() {
  const pg = new PGlite()
  await pg.exec(readSql('db/schema.sql'))
  await pg.exec(readSql('db/migrations/012_web_sessions.sql'))
  await pg.exec(readSql('db/migrations/013_web_session_profile.sql'))
  await pg.exec(readSql('db/migrations/017_web_anonymous_accounts.sql'))
  await pg.exec(readSql('db/migrations/020_web_email_magic_links.sql'))
  await pg.exec(readSql('db/migrations/024_web_telegram_devices.sql'))
  const query: Queryable = {
    query: async (sql, params) => {
      const result = await pg.query(sql, params)
      return { rows: result.rows as Record<string, unknown>[] }
    },
  }
  return { query, close: () => pg.close() }
}
async function seedTgPremium(db: Queryable, tg: number) {
  await db.query(`INSERT INTO users (telegram_id) VALUES ($1)`, [tg])
  await db.query(
    `INSERT INTO subscriptions (telegram_id, plan_id, active_until) VALUES ($1, 'premium_1m', $2)`,
    [tg, new Date(Date.now() + 30 * 86400_000).toISOString()]
  )
}
async function newAccount(db: Queryable): Promise<string> {
  const account = await db.query<{ id: string }>(`INSERT INTO web_accounts DEFAULT VALUES RETURNING id`)
  return String(account.rows[0]!.id)
}

test('device slots: 1/2/3 ok, 4th rejected; same token idempotent', async () => {
  const prev = process.env.GNH_WEB_DEVICE_LIMIT_ENABLED
  process.env.GNH_WEB_DEVICE_LIMIT_ENABLED = '1'
  const harness = await createHarness()
  try {
    const tg = 920001
    await seedTgPremium(harness.query, tg)
    const webAccountId = await newAccount(harness.query)
    await harness.query.query(
      `INSERT INTO web_telegram_links (web_account_id, telegram_id) VALUES ($1::uuid, $2::bigint)`,
      [webAccountId, tg]
    )
    const tokens = [mintDeviceToken(), mintDeviceToken(), mintDeviceToken(), mintDeviceToken()]
    for (let i = 0; i < 3; i++) {
      const reg = await registerOrReuseDevice({
        telegramId: tg,
        webAccountId,
        deviceToken: tokens[i],
        displayLabel: 'Device ' + (i + 1),
        db: harness.query,
      })
      assert.equal(reg.ok, true)
      if (reg.ok) assert.equal(reg.devicesUsed, i + 1)
    }
    const fourth = await registerOrReuseDevice({
      telegramId: tg,
      webAccountId,
      deviceToken: tokens[3],
      displayLabel: 'Device 4',
      db: harness.query,
    })
    assert.equal(fourth.ok, false)
    if (!fourth.ok) {
      assert.equal(fourth.code, 'device_limit_reached')
      assert.equal(fourth.devicesUsed, 3)
      assert.equal(fourth.devicesLimit, WEB_DEVICE_LIMIT)
    }
    const again = await registerOrReuseDevice({
      telegramId: tg,
      webAccountId,
      deviceToken: tokens[0],
      db: harness.query,
    })
    assert.equal(again.ok, true)
    if (again.ok) assert.equal(again.devicesUsed, 3)
  } finally {
    if (prev === undefined) delete process.env.GNH_WEB_DEVICE_LIMIT_ENABLED
    else process.env.GNH_WEB_DEVICE_LIMIT_ENABLED = prev
    await harness.close()
  }
})

test('device gate: telegram premium requires active slot when flag on', async () => {
  const prev = process.env.GNH_WEB_DEVICE_LIMIT_ENABLED
  process.env.GNH_WEB_DEVICE_LIMIT_ENABLED = '1'
  const harness = await createHarness()
  try {
    const tg = 920002
    await seedTgPremium(harness.query, tg)
    const webAccountId = await newAccount(harness.query)
    await harness.query.query(
      `INSERT INTO web_telegram_links (web_account_id, telegram_id) VALUES ($1::uuid, $2::bigint)`,
      [webAccountId, tg]
    )
    const token = mintDeviceToken()
    const reg = await registerDeviceFromChallengeHash({
      telegramId: tg,
      webAccountId,
      deviceTokenHash: hashDeviceToken(token),
      db: harness.query,
    })
    assert.equal(reg.ok, true)
    const withDevice = await getWebAccountPremium(webAccountId, harness.query, {
      deviceTokenHash: hashDeviceToken(token),
    })
    assert.equal(withDevice.isPremium, true)
    assert.ok(withDevice.sources.includes('telegram_subscription'))
    const without = await getWebAccountPremium(webAccountId, harness.query, {
      deviceTokenHash: hashDeviceToken(mintDeviceToken()),
    })
    assert.equal(without.sources.includes('telegram_subscription'), false)
    await grantWebEntitlement({
      webAccountId,
      planId: 'premium_web_1m',
      activeUntil: new Date(Date.now() + 10 * 86400_000),
      source: 'web_purchase',
      paymentId: 'pay_dev_1',
      db: harness.query,
    })
    const purchaseOnly = await getWebAccountPremium(webAccountId, harness.query, {
      deviceTokenHash: hashDeviceToken(mintDeviceToken()),
    })
    assert.equal(purchaseOnly.isPremium, true)
    assert.ok(purchaseOnly.sources.includes('web_purchase'))
  } finally {
    if (prev === undefined) delete process.env.GNH_WEB_DEVICE_LIMIT_ENABLED
    else process.env.GNH_WEB_DEVICE_LIMIT_ENABLED = prev
    await harness.close()
  }
})

test('logout/revoke frees a slot for a new device', async () => {
  const prev = process.env.GNH_WEB_DEVICE_LIMIT_ENABLED
  process.env.GNH_WEB_DEVICE_LIMIT_ENABLED = '1'
  const harness = await createHarness()
  try {
    const tg = 920003
    await seedTgPremium(harness.query, tg)
    const webAccountId = await newAccount(harness.query)
    await harness.query.query(
      `INSERT INTO web_telegram_links (web_account_id, telegram_id) VALUES ($1::uuid, $2::bigint)`,
      [webAccountId, tg]
    )
    const tokens = [mintDeviceToken(), mintDeviceToken(), mintDeviceToken()]
    const ids = []
    for (const token of tokens) {
      const reg = await registerOrReuseDevice({
        telegramId: tg,
        webAccountId,
        deviceToken: token,
        db: harness.query,
      })
      assert.equal(reg.ok, true)
      if (reg.ok) ids.push(reg.device.id)
    }
    assert.equal(await countActiveDevices(tg, harness.query), 3)
    await revokeDeviceByTokenHash({
      tokenHash: hashDeviceToken(tokens[1]),
      reason: 'user_logout',
      db: harness.query,
    })
    assert.equal(await countActiveDevices(tg, harness.query), 2)
    const next = await registerOrReuseDevice({
      telegramId: tg,
      webAccountId,
      deviceToken: mintDeviceToken(),
      db: harness.query,
    })
    assert.equal(next.ok, true)
    await revokeDeviceById({
      deviceId: ids[0],
      telegramId: tg,
      reason: 'remote_revoke',
      db: harness.query,
    })
    assert.ok((await countActiveDevices(tg, harness.query)) <= 2)
  } finally {
    if (prev === undefined) delete process.env.GNH_WEB_DEVICE_LIMIT_ENABLED
    else process.env.GNH_WEB_DEVICE_LIMIT_ENABLED = prev
    await harness.close()
  }
})

test('flag off: hard slot cap still 3; telegram premium not gated by device', async () => {
  const prev = process.env.GNH_WEB_DEVICE_LIMIT_ENABLED
  delete process.env.GNH_WEB_DEVICE_LIMIT_ENABLED
  const harness = await createHarness()
  try {
    const tg = 920004
    await seedTgPremium(harness.query, tg)
    const webAccountId = await newAccount(harness.query)
    await harness.query.query(
      `INSERT INTO web_telegram_links (web_account_id, telegram_id) VALUES ($1::uuid, $2::bigint)`,
      [webAccountId, tg]
    )
    for (let i = 0; i < 3; i++) {
      const reg = await registerOrReuseDevice({
        telegramId: tg,
        webAccountId,
        deviceToken: mintDeviceToken(),
        displayLabel: 'D' + (i + 1),
        db: harness.query,
      })
      assert.equal(reg.ok, true)
    }
    const fourth = await registerOrReuseDevice({
      telegramId: tg,
      webAccountId,
      deviceToken: mintDeviceToken(),
      displayLabel: 'D4',
      db: harness.query,
    })
    assert.equal(fourth.ok, false)
    // Flag off → Premium still follows link, even without matching device cookie.
    const premium = await getWebAccountPremium(webAccountId, harness.query, {
      deviceTokenHash: hashDeviceToken(mintDeviceToken()),
    })
    assert.equal(premium.isPremium, true)
    assert.ok(premium.sources.includes('telegram_subscription'))
  } finally {
    if (prev === undefined) delete process.env.GNH_WEB_DEVICE_LIMIT_ENABLED
    else process.env.GNH_WEB_DEVICE_LIMIT_ENABLED = prev
    await harness.close()
  }
})

test('idle expire frees a slot', async () => {
  const prev = process.env.GNH_WEB_DEVICE_LIMIT_ENABLED
  process.env.GNH_WEB_DEVICE_LIMIT_ENABLED = '1'
  const harness = await createHarness()
  try {
    const tg = 920005
    await seedTgPremium(harness.query, tg)
    const webAccountId = await newAccount(harness.query)
    await harness.query.query(
      `INSERT INTO web_telegram_links (web_account_id, telegram_id) VALUES ($1::uuid, $2::bigint)`,
      [webAccountId, tg]
    )
    const tokens = [mintDeviceToken(), mintDeviceToken(), mintDeviceToken()]
    for (const token of tokens) {
      const reg = await registerOrReuseDevice({
        telegramId: tg,
        webAccountId,
        deviceToken: token,
        db: harness.query,
      })
      assert.equal(reg.ok, true)
    }
    await harness.query.query(
      `UPDATE web_telegram_devices SET idle_expires_at = now() - interval '1 minute' WHERE telegram_id = $1::bigint`,
      [tg]
    )
    const { expireIdleDevices } = await import('./webTelegramDevices.js')
    const expired = await expireIdleDevices(tg, harness.query)
    assert.ok(expired >= 1)
    assert.ok((await countActiveDevices(tg, harness.query)) < 3)
  } finally {
    if (prev === undefined) delete process.env.GNH_WEB_DEVICE_LIMIT_ENABLED
    else process.env.GNH_WEB_DEVICE_LIMIT_ENABLED = prev
    await harness.close()
  }
})

test('migration seed: one legacy device per active link', async () => {
  const harness = await createHarness()
  try {
    const tg = 920006
    await seedTgPremium(harness.query, tg)
    const webAccountId = await newAccount(harness.query)
    await harness.query.query(
      `INSERT INTO web_telegram_links (web_account_id, telegram_id) VALUES ($1::uuid, $2::bigint)`,
      [webAccountId, tg]
    )
    await harness.query.query(
      `
      INSERT INTO web_telegram_devices (
        telegram_id, web_account_id, device_token_hash, display_label, is_legacy,
        linked_at, last_active_at, idle_expires_at
      )
      SELECT l.telegram_id, l.web_account_id,
             md5('legacy-a:' || l.id::text) || md5('legacy-b:' || l.id::text),
             'Current device', true, l.linked_at, now(), now() + interval '30 days'
        FROM web_telegram_links l
       WHERE l.revoked_at IS NULL
         AND l.telegram_id = $1::bigint
         AND NOT EXISTS (
           SELECT 1 FROM web_telegram_devices d
            WHERE d.telegram_id = l.telegram_id AND d.web_account_id = l.web_account_id AND d.revoked_at IS NULL
         )
    `,
      [tg]
    )
    const count = await harness.query.query(
      `SELECT COUNT(*)::text AS c FROM web_telegram_devices WHERE telegram_id = $1::bigint AND revoked_at IS NULL AND is_legacy = true`,
      [tg]
    )
    assert.equal(Number(count.rows[0].c), 1)
  } finally {
    await harness.close()
  }
})


test('legacy touch keeps idle window while flag on and cookie missing', async () => {
  const prev = process.env.GNH_WEB_DEVICE_LIMIT_ENABLED
  process.env.GNH_WEB_DEVICE_LIMIT_ENABLED = '1'
  const harness = await createHarness()
  try {
    const tg = 920007
    await seedTgPremium(harness.query, tg)
    const webAccountId = await newAccount(harness.query)
    await harness.query.query(
      `INSERT INTO web_telegram_links (web_account_id, telegram_id) VALUES ($1::uuid, $2::bigint)`,
      [webAccountId, tg]
    )
    await harness.query.query(
      `INSERT INTO web_telegram_devices (
         telegram_id, web_account_id, device_token_hash, display_label, is_legacy,
         linked_at, last_active_at, idle_expires_at
       ) VALUES (
         $1::bigint, $2::uuid,
         md5('legacy-a:x') || md5('legacy-b:x'),
         'Current device', true, now(), now(), now() + interval '1 day'
       )`,
      [tg, webAccountId]
    )
    const { hasActiveDeviceForAccount } = await import('./webTelegramDevices.js')
    const ok = await hasActiveDeviceForAccount({ webAccountId }, harness.query)
    assert.equal(ok, true)
    const row = await harness.query.query(
      `SELECT idle_expires_at FROM web_telegram_devices WHERE web_account_id = $1::uuid AND is_legacy = true`,
      [webAccountId]
    )
    assert.ok(new Date(row.rows[0].idle_expires_at).getTime() > Date.now() + 20 * 86400_000)
  } finally {
    if (prev === undefined) delete process.env.GNH_WEB_DEVICE_LIMIT_ENABLED
    else process.env.GNH_WEB_DEVICE_LIMIT_ENABLED = prev
    await harness.close()
  }
})

test('flag off: slot cap returns device_limit but premium still by link', async () => {
  const prev = process.env.GNH_WEB_DEVICE_LIMIT_ENABLED
  delete process.env.GNH_WEB_DEVICE_LIMIT_ENABLED
  const harness = await createHarness()
  try {
    const tg = 920008
    await seedTgPremium(harness.query, tg)
    const webAccountId = await newAccount(harness.query)
    await harness.query.query(
      `INSERT INTO web_telegram_links (web_account_id, telegram_id) VALUES ($1::uuid, $2::bigint)`,
      [webAccountId, tg]
    )
    for (let i = 0; i < 3; i++) {
      assert.equal(
        (
          await registerOrReuseDevice({
            telegramId: tg,
            webAccountId,
            deviceToken: mintDeviceToken(),
            db: harness.query,
          })
        ).ok,
        true
      )
    }
    const fourth = await registerOrReuseDevice({
      telegramId: tg,
      webAccountId,
      deviceToken: mintDeviceToken(),
      db: harness.query,
    })
    assert.equal(fourth.ok, false)
    const premium = await getWebAccountPremium(webAccountId, harness.query)
    assert.equal(premium.isPremium, true)
    assert.ok(premium.sources.includes('telegram_subscription'))
  } finally {
    if (prev === undefined) delete process.env.GNH_WEB_DEVICE_LIMIT_ENABLED
    else process.env.GNH_WEB_DEVICE_LIMIT_ENABLED = prev
    await harness.close()
  }
})


test('fourth and later registrations reject once three slots are filled', async () => {
  const prev = process.env.GNH_WEB_DEVICE_LIMIT_ENABLED
  process.env.GNH_WEB_DEVICE_LIMIT_ENABLED = '1'
  const harness = await createHarness()
  try {
    const tg = 920010
    await seedTgPremium(harness.query, tg)
    const webAccountId = await newAccount(harness.query)
    await harness.query.query(
      `INSERT INTO web_telegram_links (web_account_id, telegram_id) VALUES ($1::uuid, $2::bigint)`,
      [webAccountId, tg]
    )
    for (let i = 0; i < 3; i++) {
      const reg = await registerOrReuseDevice({
        telegramId: tg,
        webAccountId,
        deviceToken: mintDeviceToken(),
        displayLabel: 'P' + i,
        db: harness.query,
      })
      assert.equal(reg.ok, true)
    }
    // Burst of additional attempts after the cap is reached (PGlite has no advisory locks).
    const burst = await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        registerOrReuseDevice({
          telegramId: tg,
          webAccountId,
          deviceToken: mintDeviceToken(),
          displayLabel: 'X' + i,
          db: harness.query,
        })
      )
    )
    assert.ok(burst.every((r) => !r.ok))
    assert.equal(await countActiveDevices(tg, harness.query), WEB_DEVICE_LIMIT)
  } finally {
    if (prev === undefined) delete process.env.GNH_WEB_DEVICE_LIMIT_ENABLED
    else process.env.GNH_WEB_DEVICE_LIMIT_ENABLED = prev
    await harness.close()
  }
})

test('remote revoke requires matching telegram_id (authz)', async () => {
  const harness = await createHarness()
  try {
    const tgOwner = 920011
    const tgOther = 920012
    await seedTgPremium(harness.query, tgOwner)
    await seedTgPremium(harness.query, tgOther)
    const webAccountId = await newAccount(harness.query)
    await harness.query.query(
      `INSERT INTO web_telegram_links (web_account_id, telegram_id) VALUES ($1::uuid, $2::bigint)`,
      [webAccountId, tgOwner]
    )
    const reg = await registerOrReuseDevice({
      telegramId: tgOwner,
      webAccountId,
      deviceToken: mintDeviceToken(),
      db: harness.query,
    })
    assert.equal(reg.ok, true)
    if (!reg.ok) return
    const stolen = await revokeDeviceById({
      deviceId: reg.device.id,
      telegramId: tgOther,
      reason: 'remote_revoke',
      db: harness.query,
    })
    assert.equal(stolen, false)
    assert.equal(await countActiveDevices(tgOwner, harness.query), 1)
    const ok = await revokeDeviceById({
      deviceId: reg.device.id,
      telegramId: tgOwner,
      reason: 'remote_revoke',
      db: harness.query,
    })
    assert.equal(ok, true)
    assert.equal(await countActiveDevices(tgOwner, harness.query), 0)
  } finally {
    await harness.close()
  }
})

