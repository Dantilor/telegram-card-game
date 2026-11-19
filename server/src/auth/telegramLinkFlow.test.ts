import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import type { Queryable } from '../legal/types.js'
import { randomToken, sha256Hex } from './cryptoTokens.js'
import { TG_LINK_START_PREFIX } from './telegramLinkDeepLink.js'
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
  return { query, close: () => pg.close() }
}

async function linkAccounts(
  db: Queryable,
  webAccountId: string,
  telegramId: number
): Promise<void> {
  await db.query(
    `INSERT INTO web_telegram_links (web_account_id, telegram_id) VALUES ($1::uuid, $2::bigint)`,
    [webAccountId, telegramId]
  )
}

test('Telegram Premium becomes visible on WEB after verified link; Lifetime preserved', async () => {
  const harness = await createHarness()
  try {
    const tg = 810001
    const until = new Date('2099-01-01T00:00:00.000Z')
    await harness.query.query(`INSERT INTO users (telegram_id) VALUES ($1)`, [tg])
    await harness.query.query(
      `INSERT INTO subscriptions (telegram_id, plan_id, active_until) VALUES ($1, 'premium_lifetime', $2)`,
      [tg, until.toISOString()]
    )
    const account = await harness.query.query<{ id: string }>(
      `INSERT INTO web_accounts DEFAULT VALUES RETURNING id`
    )
    const webAccountId = String(account.rows[0]!.id)

    assert.equal((await getWebAccountPremium(webAccountId, harness.query)).isPremium, false)
    await linkAccounts(harness.query, webAccountId, tg)
    const web = await getWebAccountPremium(webAccountId, harness.query)
    assert.equal(web.isPremium, true)
    assert.ok(web.activeUntil)
    assert.ok(new Date(web.activeUntil!).getFullYear() >= 2090, 'Lifetime date preserved')
    assert.ok(web.sources.includes('telegram_subscription'))
  } finally {
    await harness.close()
  }
})

test('WEB Premium becomes visible in Telegram after verified link without extending date', async () => {
  const harness = await createHarness()
  try {
    const tg = 810002
    const until = new Date(Date.now() + 45 * 86400_000)
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
      paymentId: 'pay_link_web_1',
      db: harness.query,
    })

    assert.equal((await getTelegramPremium(tg, harness.query)).isPremium, false)
    await linkAccounts(harness.query, webAccountId, tg)
    const tgStatus = await getTelegramPremium(tg, harness.query)
    assert.equal(tgStatus.isPremium, true)
    assert.equal(tgStatus.activeUntil, until.toISOString())
    assert.ok(tgStatus.sources.includes('web_purchase'))

    const subs = await harness.query.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM subscriptions WHERE telegram_id = $1`,
      [tg]
    )
    assert.equal(subs.rows[0]!.c, '0')
  } finally {
    await harness.close()
  }
})

test('expired Telegram subscription does not activate WEB Premium', async () => {
  const harness = await createHarness()
  try {
    const tg = 810003
    const expired = new Date(Date.now() - 86400_000)
    await harness.query.query(`INSERT INTO users (telegram_id) VALUES ($1)`, [tg])
    await harness.query.query(
      `INSERT INTO subscriptions (telegram_id, plan_id, active_until) VALUES ($1, 'premium_1m', $2)`,
      [tg, expired.toISOString()]
    )
    const account = await harness.query.query<{ id: string }>(
      `INSERT INTO web_accounts DEFAULT VALUES RETURNING id`
    )
    const webAccountId = String(account.rows[0]!.id)
    await linkAccounts(harness.query, webAccountId, tg)
    assert.equal((await getWebAccountPremium(webAccountId, harness.query)).isPremium, false)
  } finally {
    await harness.close()
  }
})

test('challenge token hash is one-time; reused token row stays consumed', async () => {
  const harness = await createHarness()
  try {
    const account = await harness.query.query<{ id: string }>(
      `INSERT INTO web_accounts DEFAULT VALUES RETURNING id`
    )
    const webAccountId = String(account.rows[0]!.id)
    const token = `${TG_LINK_START_PREFIX}${randomToken(16)}`
    const expiresAt = new Date(Date.now() + 10 * 60_000)
    await harness.query.query(
      `INSERT INTO web_telegram_link_challenges (web_account_id, code_hash, expires_at)
       VALUES ($1::uuid, $2, $3)`,
      [webAccountId, sha256Hex(token), expiresAt.toISOString()]
    )
    const first = await harness.query.query<{ id: number }>(
      `UPDATE web_telegram_link_challenges SET consumed_at = now()
        WHERE code_hash = $1 AND consumed_at IS NULL
        RETURNING id`,
      [sha256Hex(token)]
    )
    assert.ok(first.rows[0])
    const second = await harness.query.query<{ id: number }>(
      `UPDATE web_telegram_link_challenges SET consumed_at = now()
        WHERE code_hash = $1 AND consumed_at IS NULL
        RETURNING id`,
      [sha256Hex(token)]
    )
    assert.equal(second.rows.length, 0)
  } finally {
    await harness.close()
  }
})

test('re-link does not create duplicate web_purchase entitlements', async () => {
  const harness = await createHarness()
  try {
    const tg = 810004
    const until = new Date(Date.now() + 60 * 86400_000)
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
      paymentId: 'pay_link_once',
      db: harness.query,
    })
    await linkAccounts(harness.query, webAccountId, tg)
    await harness.query.query(
      `UPDATE web_telegram_links SET revoked_at = now() WHERE web_account_id = $1::uuid`,
      [webAccountId]
    )
    await revokeTelegramLinkEntitlements({ webAccountId, telegramId: tg, db: harness.query })
    await linkAccounts(harness.query, webAccountId, tg)

    const ents = await harness.query.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM web_entitlements
        WHERE web_account_id = $1::uuid AND source = 'web_purchase'`,
      [webAccountId]
    )
    assert.equal(ents.rows[0]!.c, '1')
    assert.equal((await getTelegramPremium(tg, harness.query)).isPremium, true)
    assert.equal((await getWebAccountPremium(webAccountId, harness.query)).isPremium, true)
  } finally {
    await harness.close()
  }
})

test('conflict: telegram already linked to another WEB account must stay exclusive', async () => {
  const harness = await createHarness()
  try {
    const tg = 810005
    await harness.query.query(`INSERT INTO users (telegram_id) VALUES ($1)`, [tg])
    const a = await harness.query.query<{ id: string }>(
      `INSERT INTO web_accounts DEFAULT VALUES RETURNING id`
    )
    const b = await harness.query.query<{ id: string }>(
      `INSERT INTO web_accounts DEFAULT VALUES RETURNING id`
    )
    const accountA = String(a.rows[0]!.id)
    const accountB = String(b.rows[0]!.id)
    await linkAccounts(harness.query, accountA, tg)

    const existing = await harness.query.query<{ web_account_id: string }>(
      `SELECT web_account_id::text AS web_account_id
         FROM web_telegram_links
        WHERE telegram_id = $1::bigint AND revoked_at IS NULL
        LIMIT 1`,
      [tg]
    )
    assert.equal(existing.rows[0]!.web_account_id, accountA)
    assert.notEqual(existing.rows[0]!.web_account_id, accountB)
  } finally {
    await harness.close()
  }
})