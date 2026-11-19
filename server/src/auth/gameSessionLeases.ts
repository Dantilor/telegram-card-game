import type { Queryable, TransactionRunner } from '../legal/types.js'
import { query as defaultQuery } from '../db.js'
import { withTransaction as defaultWithTransaction } from '../legal/runtime.js'
import type { ResolvedAuth } from './resolveAuth.js'

type Db = {
  query: <T>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>
}

function db(custom?: Queryable): Db {
  if (custom) {
    return {
      query: async <T>(sql: string, params?: unknown[]) => {
        const result = await custom.query<T>(sql, params)
        return { rows: result.rows as T[] }
      },
    }
  }
  return {
    query: async <T>(sql: string, params?: unknown[]) => {
      const result = await defaultQuery(sql, params)
      return { rows: result.rows as T[] }
    },
  }
}

export const GAME_SESSION_LIMIT = 3
export const GAME_SESSION_TTL_MS = 120_000

export function gameSessionLimitEnabled(): boolean {
  return (
    process.env.GNH_GAME_SESSION_LIMIT_ENABLED === '1' ||
    process.env.GNH_GAME_SESSION_LIMIT_ENABLED === 'true'
  )
}

export type OwnerSubjects = {
  lockKey: string
  webAccountId: string | null
  telegramId: number | null
}

/** Canonical lock key: linked pair shares pair:tg:{id}; otherwise web: or tg:. */
export async function resolveOwnerSubjects(
  auth: ResolvedAuth,
  customDb?: Queryable
): Promise<OwnerSubjects | null> {
  if (auth.webAccountId) {
    const link = await db(customDb).query<{ telegram_id: string }>(
      `SELECT telegram_id::text AS telegram_id
         FROM web_telegram_links
        WHERE web_account_id = $1::uuid AND revoked_at IS NULL
        ORDER BY linked_at DESC NULLS LAST, id DESC
        LIMIT 1`,
      [auth.webAccountId]
    )
    const tg = link.rows[0]?.telegram_id ? Number(link.rows[0].telegram_id) : null
    if (tg && Number.isFinite(tg)) {
      return {
        lockKey: `pair:tg:${tg}`,
        webAccountId: auth.webAccountId,
        telegramId: tg,
      }
    }
    return {
      lockKey: `web:${auth.webAccountId}`,
      webAccountId: auth.webAccountId,
      telegramId: null,
    }
  }
  if (auth.telegramId) {
    const link = await db(customDb).query<{ web_account_id: string }>(
      `SELECT web_account_id::text AS web_account_id
         FROM web_telegram_links
        WHERE telegram_id = $1::bigint AND revoked_at IS NULL
        ORDER BY linked_at DESC NULLS LAST, id DESC
        LIMIT 1`,
      [auth.telegramId]
    )
    const web = link.rows[0]?.web_account_id ?? null
    if (web) {
      return {
        lockKey: `pair:tg:${auth.telegramId}`,
        webAccountId: web,
        telegramId: auth.telegramId,
      }
    }
    return {
      lockKey: `tg:${auth.telegramId}`,
      webAccountId: null,
      telegramId: auth.telegramId,
    }
  }
  return null
}

function leaseError(message: string, status: number, code: string) {
  const err = new Error(message) as Error & { status?: number; code?: string }
  err.status = status
  err.code = code
  return err
}

export type LeaseRow = {
  id: string
  client_lease_id: string
  game_id: string
  expires_at: Date
  active_count: number
}

async function expireStale(lockKey: string, tx: Queryable): Promise<void> {
  await tx.query(
    `UPDATE game_session_leases
        SET released_at = now()
      WHERE owner_lock_key = $1
        AND released_at IS NULL
        AND expires_at <= now()`,
    [lockKey]
  )
}

export async function acquireGameSessionLease(input: {
  auth: ResolvedAuth
  clientLeaseId: string
  gameId: string
  withTransaction?: TransactionRunner
  db?: Queryable
}): Promise<LeaseRow> {
  const clientLeaseId = input.clientLeaseId.trim()
  const gameId = input.gameId.trim().slice(0, 64)
  if (clientLeaseId.length < 8 || clientLeaseId.length > 128) {
    throw leaseError('Invalid client lease id', 400, 'invalid_client_lease')
  }
  if (!gameId) throw leaseError('gameId required', 400, 'invalid_game')

  const owner = await resolveOwnerSubjects(input.auth, input.db)
  if (!owner) throw leaseError('Unauthorized', 401, 'unauthorized')

  const expiresAt = new Date(Date.now() + GAME_SESSION_TTL_MS)
  const runTx = input.withTransaction ?? defaultWithTransaction

  return runTx(async (tx) => {
    await tx.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [owner.lockKey])
    await expireStale(owner.lockKey, tx)

    const existing = await tx.query<{
      id: string
      client_lease_id: string
      game_id: string
      expires_at: Date
    }>(
      `SELECT id::text AS id, client_lease_id, game_id, expires_at
         FROM game_session_leases
        WHERE client_lease_id = $1
          AND released_at IS NULL
          AND expires_at > now()
        LIMIT 1
        FOR UPDATE`,
      [clientLeaseId]
    )
    if (existing.rows[0]) {
      const row = existing.rows[0]
      await tx.query(
        `UPDATE game_session_leases
            SET last_seen_at = now(),
                expires_at = $2,
                game_id = $3,
                owner_lock_key = $4,
                web_account_id = $5::uuid,
                telegram_id = $6::bigint
          WHERE id = $1::uuid`,
        [
          row.id,
          expiresAt.toISOString(),
          gameId,
          owner.lockKey,
          owner.webAccountId,
          owner.telegramId,
        ]
      )
      const count = await countActive(owner.lockKey, tx)
      return {
        id: row.id,
        client_lease_id: clientLeaseId,
        game_id: gameId,
        expires_at: expiresAt,
        active_count: count,
      }
    }

    const count = await countActive(owner.lockKey, tx)
    if (count >= GAME_SESSION_LIMIT) {
      throw leaseError('Game session limit reached', 409, 'game_session_limit_reached')
    }

    const inserted = await tx.query<{ id: string }>(
      `INSERT INTO game_session_leases
        (client_lease_id, web_account_id, telegram_id, owner_lock_key, game_id, expires_at)
       VALUES ($1, $2::uuid, $3::bigint, $4, $5, $6)
       RETURNING id::text AS id`,
      [
        clientLeaseId,
        owner.webAccountId,
        owner.telegramId,
        owner.lockKey,
        gameId,
        expiresAt.toISOString(),
      ]
    )
    return {
      id: inserted.rows[0]!.id,
      client_lease_id: clientLeaseId,
      game_id: gameId,
      expires_at: expiresAt,
      active_count: count + 1,
    }
  })
}

async function countActive(lockKey: string, tx: Queryable): Promise<number> {
  const result = await tx.query<{ c: string }>(
    `SELECT count(*)::text AS c
       FROM game_session_leases
      WHERE owner_lock_key = $1
        AND released_at IS NULL
        AND expires_at > now()`,
    [lockKey]
  )
  return Number(result.rows[0]?.c || 0)
}

export async function heartbeatGameSessionLease(input: {
  auth: ResolvedAuth
  clientLeaseId: string
  withTransaction?: TransactionRunner
  db?: Queryable
}): Promise<LeaseRow> {
  const clientLeaseId = input.clientLeaseId.trim()
  const owner = await resolveOwnerSubjects(input.auth, input.db)
  if (!owner) throw leaseError('Unauthorized', 401, 'unauthorized')
  const expiresAt = new Date(Date.now() + GAME_SESSION_TTL_MS)
  const runTx = input.withTransaction ?? defaultWithTransaction

  return runTx(async (tx) => {
    await tx.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [owner.lockKey])
    await expireStale(owner.lockKey, tx)
    const updated = await tx.query<{
      id: string
      client_lease_id: string
      game_id: string
      expires_at: Date
    }>(
      `UPDATE game_session_leases
          SET last_seen_at = now(),
              expires_at = $2
        WHERE client_lease_id = $1
          AND released_at IS NULL
          AND expires_at > now()
          AND owner_lock_key = $3
        RETURNING id::text AS id, client_lease_id, game_id, expires_at`,
      [clientLeaseId, expiresAt.toISOString(), owner.lockKey]
    )
    if (!updated.rows[0]) {
      throw leaseError('Lease not found or expired', 404, 'lease_not_found')
    }
    const count = await countActive(owner.lockKey, tx)
    return {
      id: updated.rows[0].id,
      client_lease_id: updated.rows[0].client_lease_id,
      game_id: updated.rows[0].game_id,
      expires_at: new Date(updated.rows[0].expires_at),
      active_count: count,
    }
  })
}

export async function releaseGameSessionLease(input: {
  auth: ResolvedAuth
  clientLeaseId: string
  withTransaction?: TransactionRunner
  db?: Queryable
}): Promise<{ released: boolean; active_count: number }> {
  const clientLeaseId = input.clientLeaseId.trim()
  const owner = await resolveOwnerSubjects(input.auth, input.db)
  if (!owner) throw leaseError('Unauthorized', 401, 'unauthorized')
  const runTx = input.withTransaction ?? defaultWithTransaction

  return runTx(async (tx) => {
    await tx.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [owner.lockKey])
    const released = await tx.query<{ id: string }>(
      `UPDATE game_session_leases
          SET released_at = now()
        WHERE client_lease_id = $1
          AND released_at IS NULL
          AND owner_lock_key = $2
        RETURNING id::text AS id`,
      [clientLeaseId, owner.lockKey]
    )
    await expireStale(owner.lockKey, tx)
    const count = await countActive(owner.lockKey, tx)
    return { released: Boolean(released.rows[0]), active_count: count }
  })
}

export async function statusGameSessionLeases(input: {
  auth: ResolvedAuth
  db?: Queryable
}): Promise<{ active_count: number; limit: number; lockKey: string }> {
  const owner = await resolveOwnerSubjects(input.auth, input.db)
  if (!owner) throw leaseError('Unauthorized', 401, 'unauthorized')
  const q = db(input.db)
  await q.query(
    `UPDATE game_session_leases
        SET released_at = now()
      WHERE owner_lock_key = $1
        AND released_at IS NULL
        AND expires_at <= now()`,
    [owner.lockKey]
  )
  const count = await q.query<{ c: string }>(
    `SELECT count(*)::text AS c
       FROM game_session_leases
      WHERE owner_lock_key = $1
        AND released_at IS NULL
        AND expires_at > now()`,
    [owner.lockKey]
  )
  return {
    active_count: Number(count.rows[0]?.c || 0),
    limit: GAME_SESSION_LIMIT,
    lockKey: owner.lockKey,
  }
}

/**
 * After WEB↔Telegram link: merge active leases onto shared pair key.
 * If combined active > limit, expire oldest excess (does not delete purchases).
 */
export async function reconcileLeasesAfterTelegramLink(input: {
  webAccountId: string
  telegramId: number
  db?: Queryable
}): Promise<{ merged: number; trimmed: number }> {
  const lockKey = `pair:tg:${input.telegramId}`
  const run = async (tx: Queryable) => {
    await tx.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [lockKey])
    await tx.query(
      `UPDATE game_session_leases
          SET released_at = now()
        WHERE released_at IS NULL
          AND expires_at <= now()
          AND (
            owner_lock_key = $1
            OR owner_lock_key = $2
            OR owner_lock_key = $3
            OR web_account_id = $4::uuid
            OR telegram_id = $5::bigint
          )`,
      [`web:${input.webAccountId}`, `tg:${input.telegramId}`, lockKey, input.webAccountId, input.telegramId]
    )
    const merged = await tx.query<{ id: string }>(
      `UPDATE game_session_leases
          SET owner_lock_key = $1,
              web_account_id = COALESCE(web_account_id, $2::uuid),
              telegram_id = COALESCE(telegram_id, $3::bigint)
        WHERE released_at IS NULL
          AND expires_at > now()
          AND (
            web_account_id = $2::uuid
            OR telegram_id = $3::bigint
            OR owner_lock_key IN ($4, $5)
          )
        RETURNING id::text AS id`,
      [lockKey, input.webAccountId, input.telegramId, `web:${input.webAccountId}`, `tg:${input.telegramId}`]
    )

    const active = await tx.query<{ id: string; created_at: Date }>(
      `SELECT id::text AS id, created_at
         FROM game_session_leases
        WHERE owner_lock_key = $1
          AND released_at IS NULL
          AND expires_at > now()
        ORDER BY created_at ASC`,
      [lockKey]
    )
    let trimmed = 0
    if (active.rows.length > GAME_SESSION_LIMIT) {
      const excess = active.rows.slice(0, active.rows.length - GAME_SESSION_LIMIT)
      for (const row of excess) {
        await tx.query(
          `UPDATE game_session_leases SET released_at = now() WHERE id = $1::uuid AND released_at IS NULL`,
          [row.id]
        )
        trimmed += 1
      }
    }
    return { merged: merged.rows.length, trimmed }
  }

  if (input.db) return run(input.db)
  return defaultWithTransaction(run)
}