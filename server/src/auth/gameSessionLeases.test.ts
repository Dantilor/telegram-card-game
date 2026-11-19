import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import type { Queryable, TransactionRunner } from '../legal/types.js'
import {
  GAME_SESSION_LIMIT,
  acquireGameSessionLease,
  gameSessionLimitEnabled,
  reconcileLeasesAfterTelegramLink,
  releaseGameSessionLease,
  resolveOwnerSubjects,
  statusGameSessionLeases,
} from './gameSessionLeases.js'
import type { ResolvedAuth } from './resolveAuth.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(here, '../..')

function readSql(rel: string): string {
  return fs.readFileSync(path.join(serverRoot, rel), 'utf8')
}

async function createHarness() {
  const pg = new PGlite()
  await pg.exec(readSql('db/schema.sql'))
  await pg.exec(readSql('db/migrations/012_web_sessions.sql'))
  await pg.exec(readSql('db/migrations/013_web_session_profile.sql'))
  await pg.exec(readSql('db/migrations/017_web_anonymous_accounts.sql'))
  await pg.exec(readSql('db/migrations/021_game_session_leases.sql'))

  const wrap = (client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> }): Queryable => ({
    query: async <T>(sql: string, params?: unknown[]) => {
      const result = await client.query(sql, params)
      return { rows: result.rows as T[] }
    },
  })

  const query = wrap(pg)
  const withTransaction: TransactionRunner = (fn) =>
    pg.transaction(async (tx) => fn(wrap(tx)))

  return { query, withTransaction, close: () => pg.close() }
}

function webAuth(webAccountId: string): ResolvedAuth {
  return { webAccountId, source: 'web_account' }
}

function tgAuth(telegramId: number): ResolvedAuth {
  return { telegramId, source: 'telegram_init_data' }
}

test('feature flag defaults off', () => {
  const prev = process.env.GNH_GAME_SESSION_LIMIT_ENABLED
  delete process.env.GNH_GAME_SESSION_LIMIT_ENABLED
  assert.equal(gameSessionLimitEnabled(), false)
  process.env.GNH_GAME_SESSION_LIMIT_ENABLED = '1'
  assert.equal(gameSessionLimitEnabled(), true)
  if (prev === undefined) delete process.env.GNH_GAME_SESSION_LIMIT_ENABLED
  else process.env.GNH_GAME_SESSION_LIMIT_ENABLED = prev
})

test('three active leases allowed; fourth rejected; release frees slot', async () => {
  const h = await createHarness()
  try {
    const account = await h.query.query<{ id: string }>(`INSERT INTO web_accounts DEFAULT VALUES RETURNING id`)
    const webAccountId = String(account.rows[0]!.id)
    const auth = webAuth(webAccountId)
    const opts = { auth, withTransaction: h.withTransaction, db: h.query }

    for (let i = 1; i <= GAME_SESSION_LIMIT; i++) {
      const lease = await acquireGameSessionLease({
        ...opts,
        clientLeaseId: `client_lease_${i}_xxxx`,
        gameId: `game_${i}`,
      })
      assert.equal(lease.active_count, i)
    }

    await assert.rejects(
      () =>
        acquireGameSessionLease({
          ...opts,
          clientLeaseId: 'client_lease_4_xxxx',
          gameId: 'game_4',
        }),
      (err: Error & { status?: number; code?: string }) => {
        assert.equal(err.status, 409)
        assert.equal(err.code, 'game_session_limit_reached')
        return true
      }
    )

    const released = await releaseGameSessionLease({
      ...opts,
      clientLeaseId: 'client_lease_1_xxxx',
    })
    assert.equal(released.released, true)
    assert.equal(released.active_count, 2)

    const again = await acquireGameSessionLease({
      ...opts,
      clientLeaseId: 'client_lease_4_xxxx',
      gameId: 'game_4',
    })
    assert.equal(again.active_count, 3)
  } finally {
    await h.close()
  }
})

test('re-acquire same clientLeaseId does not consume a new slot', async () => {
  const h = await createHarness()
  try {
    const account = await h.query.query<{ id: string }>(`INSERT INTO web_accounts DEFAULT VALUES RETURNING id`)
    const webAccountId = String(account.rows[0]!.id)
    const auth = webAuth(webAccountId)
    const opts = { auth, withTransaction: h.withTransaction, db: h.query }

    await acquireGameSessionLease({ ...opts, clientLeaseId: 'same_lease_id_01', gameId: 'alias' })
    await acquireGameSessionLease({ ...opts, clientLeaseId: 'same_lease_id_01', gameId: 'alias' })
    await acquireGameSessionLease({ ...opts, clientLeaseId: 'same_lease_id_01', gameId: 'quiz' })

    const status = await statusGameSessionLeases({ auth, db: h.query })
    assert.equal(status.active_count, 1)
  } finally {
    await h.close()
  }
})

test('expired TTL frees a slot automatically on acquire', async () => {
  const h = await createHarness()
  try {
    const account = await h.query.query<{ id: string }>(`INSERT INTO web_accounts DEFAULT VALUES RETURNING id`)
    const webAccountId = String(account.rows[0]!.id)
    const auth = webAuth(webAccountId)
    const opts = { auth, withTransaction: h.withTransaction, db: h.query }

    for (let i = 1; i <= 3; i++) {
      await acquireGameSessionLease({
        ...opts,
        clientLeaseId: `ttl_lease_${i}_xxxx`,
        gameId: 'cards',
      })
    }

    await h.query.query(
      `UPDATE game_session_leases
          SET expires_at = now() - interval '1 second'
        WHERE client_lease_id = 'ttl_lease_1_xxxx'`
    )

    const fourth = await acquireGameSessionLease({
      ...opts,
      clientLeaseId: 'ttl_lease_4_xxxx',
      gameId: 'cards',
    })
    assert.equal(fourth.active_count, 3)
  } finally {
    await h.close()
  }
})

test('linked WEB+Telegram share one owner lock key and trim on reconcile', async () => {
  const h = await createHarness()
  try {
    const account = await h.query.query<{ id: string }>(`INSERT INTO web_accounts DEFAULT VALUES RETURNING id`)
    const webAccountId = String(account.rows[0]!.id)
    const telegramId = 424242

    for (let i = 1; i <= 2; i++) {
      await acquireGameSessionLease({
        auth: webAuth(webAccountId),
        clientLeaseId: `web_only_${i}_xxxx`,
        gameId: 'web',
        withTransaction: h.withTransaction,
        db: h.query,
      })
    }
    for (let i = 1; i <= 2; i++) {
      await acquireGameSessionLease({
        auth: tgAuth(telegramId),
        clientLeaseId: `tg_only_${i}_xxxx`,
        gameId: 'tg',
        withTransaction: h.withTransaction,
        db: h.query,
      })
    }

    await h.query.query(
      `INSERT INTO web_telegram_links (web_account_id, telegram_id)
       VALUES ($1::uuid, $2::bigint)`,
      [webAccountId, telegramId]
    )

    const beforeWeb = await resolveOwnerSubjects(webAuth(webAccountId), h.query)
    const beforeTg = await resolveOwnerSubjects(tgAuth(telegramId), h.query)
    assert.equal(beforeWeb?.lockKey, `pair:tg:${telegramId}`)
    assert.equal(beforeTg?.lockKey, `pair:tg:${telegramId}`)

    const reconciled = await reconcileLeasesAfterTelegramLink({
      webAccountId,
      telegramId,
      db: h.query,
    })
    assert.ok(reconciled.merged >= 3)
    assert.equal(reconciled.trimmed, 1)

    const status = await statusGameSessionLeases({
      auth: webAuth(webAccountId),
      db: h.query,
    })
    assert.equal(status.active_count, 3)
    assert.equal(status.lockKey, `pair:tg:${telegramId}`)
  } finally {
    await h.close()
  }
})

test('parallel acquires cannot exceed the limit', async () => {
  const h = await createHarness()
  try {
    const account = await h.query.query<{ id: string }>(`INSERT INTO web_accounts DEFAULT VALUES RETURNING id`)
    const webAccountId = String(account.rows[0]!.id)
    const auth = webAuth(webAccountId)
    const opts = { auth, withTransaction: h.withTransaction, db: h.query }

    const results = await Promise.allSettled(
      Array.from({ length: 6 }, (_, i) =>
        acquireGameSessionLease({
          ...opts,
          clientLeaseId: `parallel_${i}_lease`,
          gameId: 'race',
        })
      )
    )

    const ok = results.filter((r) => r.status === 'fulfilled')
    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[]
    assert.equal(ok.length, 3)
    assert.equal(rejected.length, 3)
    for (const r of rejected) {
      const err = r.reason as Error & { code?: string; status?: number }
      assert.equal(err.code, 'game_session_limit_reached')
      assert.equal(err.status, 409)
    }

    const status = await statusGameSessionLeases({ auth, db: h.query })
    assert.equal(status.active_count, 3)
  } finally {
    await h.close()
  }
})