import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import type { Queryable } from '../legal/types.js'
import {
  getTelegramPremium,
  getWebAccountPremium,
  grantWebEntitlement,
  revokeTelegramLinkEntitlements,
} from './webAccounts.js'

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
  const query: Queryable = {
    query: async (sql, params) => {
      const result = await pg.query(sql, params)
      return { rows: result.rows as Record<string, unknown>[] }
    },
  }
  return {
    query,
    close: () => pg.close(),
  }
}

test('shared Premium: Telegram purchase restores to WEB after verified link', async () => {
  const harness = await createHarness()
  try {
    const tg = 700001
    const until = new Date(Date.now() + 30 * 86400_000)
    await harness.query.query(`INSERT INTO users (telegram_id) VALUES ($1)`, [tg])
    await harness.query.query(
      `INSERT INTO subscriptions (telegram_id, plan_id, active_until)
       VALUES ($1, 'premium_1m', $2)`,
      [tg, until.toISOString()]
    )
    const account = await harness.query.query<{ id: string }>(
      `INSERT INTO web_accounts DEFAULT VALUES RETURNING id`
    )
    const webAccountId = String(account.rows[0]!.id)

    let web = await getWebAccountPremium(webAccountId, harness.query)
    assert.equal(web.isPremium, false)

    await harness.query.query(
      `INSERT INTO web_telegram_links (web_account_id, telegram_id) VALUES ($1::uuid, $2::bigint)`,
      [webAccountId, tg]
    )

    web = await getWebAccountPremium(webAccountId, harness.query)
    const tgStatus = await getTelegramPremium(tg, harness.query)
    assert.equal(web.isPremium, true)
    assert.equal(tgStatus.isPremium, true)
    assert.ok(web.sources.includes('telegram_subscription'))
    assert.ok(tgStatus.sources.includes('telegram_subscription'))
    assert.equal(web.sources.includes('web_purchase'), false)
  } finally {
    await harness.close()
  }
})

test('shared Premium: WEB purchase restores to Telegram after verified link without writing subscriptions', async () => {
  const harness = await createHarness()
  try {
    const tg = 700002
    const until = new Date(Date.now() + 90 * 86400_000)
    await harness.query.query(`INSERT INTO users (telegram_id) VALUES ($1)`, [tg])
    const account = await harness.query.query<{ id: string }>(
      `INSERT INTO web_accounts DEFAULT VALUES RETURNING id`
    )
    const webAccountId = String(account.rows[0]!.id)

    await grantWebEntitlement({
      webAccountId,
      planId: 'premium_3m',
      activeUntil: until,
      source: 'web_purchase',
      paymentId: 'pay_web_shared_1',
      db: harness.query,
    })

    let tgStatus = await getTelegramPremium(tg, harness.query)
    assert.equal(tgStatus.isPremium, false, 'unlinked telegram must not see WEB purchase')

    await harness.query.query(
      `INSERT INTO web_telegram_links (web_account_id, telegram_id) VALUES ($1::uuid, $2::bigint)`,
      [webAccountId, tg]
    )

    tgStatus = await getTelegramPremium(tg, harness.query)
    const web = await getWebAccountPremium(webAccountId, harness.query)
    assert.equal(tgStatus.isPremium, true)
    assert.equal(web.isPremium, true)
    assert.ok(tgStatus.sources.includes('web_purchase'))
    assert.ok(web.sources.includes('web_purchase'))

    const subs = await harness.query.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM subscriptions WHERE telegram_id = $1`,
      [tg]
    )
    assert.equal(subs.rows[0]!.c, '0', 'WEB purchase must not be copied into subscriptions')
  } finally {
    await harness.close()
  }
})

test('shared Premium: unlink keeps original purchases on both sides', async () => {
  const harness = await createHarness()
  try {
    const tg = 700003
    const tgUntil = new Date(Date.now() + 30 * 86400_000)
    const webUntil = new Date(Date.now() + 3650 * 86400_000)
    await harness.query.query(`INSERT INTO users (telegram_id) VALUES ($1)`, [tg])
    await harness.query.query(
      `INSERT INTO subscriptions (telegram_id, plan_id, active_until)
       VALUES ($1, 'premium_1m', $2)`,
      [tg, tgUntil.toISOString()]
    )
    const account = await harness.query.query<{ id: string }>(
      `INSERT INTO web_accounts DEFAULT VALUES RETURNING id`
    )
    const webAccountId = String(account.rows[0]!.id)
    await grantWebEntitlement({
      webAccountId,
      planId: 'premium_lifetime',
      activeUntil: webUntil,
      source: 'web_purchase',
      paymentId: 'pay_web_shared_2',
      db: harness.query,
    })
    await harness.query.query(
      `INSERT INTO web_telegram_links (web_account_id, telegram_id) VALUES ($1::uuid, $2::bigint)`,
      [webAccountId, tg]
    )
    await grantWebEntitlement({
      webAccountId,
      planId: 'premium_1m',
      activeUntil: tgUntil,
      source: 'telegram_link',
      linkedTelegramId: tg,
      db: harness.query,
    })

    await harness.query.query(
      `UPDATE web_telegram_links SET revoked_at = now()
        WHERE web_account_id = $1::uuid AND revoked_at IS NULL`,
      [webAccountId]
    )
    await revokeTelegramLinkEntitlements({ webAccountId, telegramId: tg, db: harness.query })

    const web = await getWebAccountPremium(webAccountId, harness.query)
    const tgStatus = await getTelegramPremium(tg, harness.query)
    assert.equal(web.isPremium, true)
    assert.ok(web.sources.includes('web_purchase'))
    assert.equal(web.sources.includes('telegram_subscription'), false)
    assert.equal(tgStatus.isPremium, true)
    assert.ok(tgStatus.sources.includes('telegram_subscription'))
    assert.equal(tgStatus.sources.includes('web_purchase'), false)

    const sub = await harness.query.query<{ active_until: Date }>(
      `SELECT active_until FROM subscriptions WHERE telegram_id = $1`,
      [tg]
    )
    assert.ok(new Date(sub.rows[0]!.active_until) > new Date())
    const purchase = await harness.query.query<{ active_until: Date }>(
      `SELECT active_until FROM web_entitlements
        WHERE web_account_id = $1::uuid AND source = 'web_purchase' AND active_until > now()`,
      [webAccountId]
    )
    assert.equal(purchase.rows.length, 1)
  } finally {
    await harness.close()
  }
})

test('shared Premium: isLifetime from plan_id, not far-future date; lastEndedAt after expiry', async () => {
  const harness = await createHarness()
  try {
    const account = await harness.query.query<{ id: string }>(
      `INSERT INTO web_accounts DEFAULT VALUES RETURNING id`
    )
    const webAccountId = String(account.rows[0]!.id)

    const farFuture = new Date(Date.now() + 100 * 365 * 86400_000)
    await grantWebEntitlement({
      webAccountId,
      planId: 'premium_1m',
      activeUntil: farFuture,
      source: 'web_purchase',
      paymentId: 'pay_far_1m',
      db: harness.query,
    })
    let status = await getWebAccountPremium(webAccountId, harness.query)
    assert.equal(status.isPremium, true)
    assert.equal(status.isLifetime, false, 'far future 1m must not be treated as lifetime')

    await grantWebEntitlement({
      webAccountId,
      planId: 'premium_web_lifetime',
      activeUntil: farFuture,
      source: 'web_purchase',
      paymentId: 'pay_life',
      db: harness.query,
    })
    status = await getWebAccountPremium(webAccountId, harness.query)
    assert.equal(status.isPremium, true)
    assert.equal(status.isLifetime, true)
    assert.equal(status.lastEndedAt, null)

    const ended = new Date(Date.now() - 2 * 86400_000)
    await harness.query.query(
      `UPDATE web_entitlements SET active_until = $2 WHERE web_account_id = $1::uuid`,
      [webAccountId, ended.toISOString()]
    )
    status = await getWebAccountPremium(webAccountId, harness.query)
    assert.equal(status.isPremium, false)
    assert.equal(status.isLifetime, false)
    assert.ok(status.lastEndedAt)
    assert.ok(new Date(status.lastEndedAt!) <= new Date())
  } finally {
    await harness.close()
  }
})

test('shared Premium: two entitlements keep access until the later end date', async () => {
  const harness = await createHarness()
  try {
    const account = await harness.query.query<{ id: string }>(
      `INSERT INTO web_accounts DEFAULT VALUES RETURNING id`
    )
    const webAccountId = String(account.rows[0]!.id)
    const soon = new Date(Date.now() + 5 * 86400_000)
    const later = new Date(Date.now() + 40 * 86400_000)
    await grantWebEntitlement({
      webAccountId,
      planId: 'premium_1m',
      activeUntil: soon,
      source: 'web_purchase',
      paymentId: 'pay_soon',
      db: harness.query,
    })
    await grantWebEntitlement({
      webAccountId,
      planId: 'premium_3m',
      activeUntil: later,
      source: 'web_purchase',
      paymentId: 'pay_later',
      db: harness.query,
    })
    const status = await getWebAccountPremium(webAccountId, harness.query)
    assert.equal(status.isPremium, true)
    assert.equal(status.activeUntil, later.toISOString())

    await harness.query.query(
      `UPDATE web_entitlements SET active_until = now() - interval '1 hour'
        WHERE web_account_id = $1::uuid AND payment_id = 'pay_soon'`,
      [webAccountId]
    )
    const after = await getWebAccountPremium(webAccountId, harness.query)
    assert.equal(after.isPremium, true)
    assert.equal(after.activeUntil, later.toISOString())
  } finally {
    await harness.close()
  }
})

test('shared Premium: re-link does not extend original WEB purchase duration', async () => {
  const harness = await createHarness()
  try {
    const tg = 700004
    const until = new Date(Date.now() + 10 * 86400_000)
    await harness.query.query(`INSERT INTO users (telegram_id) VALUES ($1)`, [tg])
    const account = await harness.query.query<{ id: string }>(
      `INSERT INTO web_accounts DEFAULT VALUES RETURNING id`
    )
    const webAccountId = String(account.rows[0]!.id)
    await grantWebEntitlement({
      webAccountId,
      planId: 'premium_1m',
      activeUntil: until,
      source: 'web_purchase',
      paymentId: 'pay_web_shared_3',
      db: harness.query,
    })
    await harness.query.query(
      `INSERT INTO web_telegram_links (web_account_id, telegram_id) VALUES ($1::uuid, $2::bigint)`,
      [webAccountId, tg]
    )
    const first = await getTelegramPremium(tg, harness.query)
    assert.equal(first.isPremium, true)
    assert.equal(first.activeUntil, until.toISOString())

    await harness.query.query(
      `UPDATE web_telegram_links SET revoked_at = now() WHERE web_account_id = $1::uuid`,
      [webAccountId]
    )
    await harness.query.query(
      `INSERT INTO web_telegram_links (web_account_id, telegram_id) VALUES ($1::uuid, $2::bigint)`,
      [webAccountId, tg]
    )
    const second = await getTelegramPremium(tg, harness.query)
    assert.equal(second.activeUntil, until.toISOString())
    const subs = await harness.query.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM subscriptions WHERE telegram_id = $1`,
      [tg]
    )
    assert.equal(subs.rows[0]!.c, '0')
  } finally {
    await harness.close()
  }
})
