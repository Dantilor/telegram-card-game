import type { Queryable } from '../legal/types.js'
import { query as defaultQuery } from '../db.js'
import { randomToken, sha256Hex, timingSafeEqualHex } from './cryptoTokens.js'
import { sessionTtlMs } from './config.js'

export type WebSessionRecord = {
  id: number
  telegram_id: string | number
  expires_at: Date
  revoked_at: Date | null
  csrf_hash: string
}

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

export type CreatedWebSession = {
  sessionToken: string
  csrfToken: string
  expiresAt: Date
  telegramId: number
}

export async function createWebSession(
  telegramId: number,
  opts?: { userAgent?: string | null; db?: Queryable }
): Promise<CreatedWebSession> {
  const sessionToken = randomToken(32)
  const csrfToken = randomToken(32)
  const expiresAt = new Date(Date.now() + sessionTtlMs())
  const uaHash = opts?.userAgent ? sha256Hex(opts.userAgent.slice(0, 512)) : null

  await db(opts?.db).query(
    `INSERT INTO web_sessions (token_hash, csrf_hash, telegram_id, expires_at, user_agent_hash)
     VALUES ($1, $2, $3::bigint, $4, $5)`,
    [sha256Hex(sessionToken), sha256Hex(csrfToken), telegramId, expiresAt.toISOString(), uaHash]
  )

  return { sessionToken, csrfToken, expiresAt, telegramId }
}

export async function findActiveSessionByToken(
  sessionToken: string,
  customDb?: Queryable
): Promise<WebSessionRecord | null> {
  if (!sessionToken?.trim()) return null
  const tokenHash = sha256Hex(sessionToken.trim())
  const result = await db(customDb).query<WebSessionRecord>(
    `SELECT id, telegram_id, expires_at, revoked_at, csrf_hash
     FROM web_sessions
     WHERE token_hash = $1
     LIMIT 1`,
    [tokenHash]
  )
  const row = result.rows[0]
  if (!row) return null
  if (row.revoked_at) return null
  const expiresAt = new Date(row.expires_at)
  if (!(expiresAt.getTime() > Date.now())) return null
  return row
}

export async function touchSession(sessionId: number, customDb?: Queryable): Promise<Date> {
  const ttl = sessionTtlMs()
  const expiresAt = new Date(Date.now() + ttl)
  await db(customDb).query(
    `UPDATE web_sessions
     SET last_seen_at = now(), expires_at = $2
     WHERE id = $1 AND revoked_at IS NULL`,
    [sessionId, expiresAt.toISOString()]
  )
  return expiresAt
}

export async function revokeSessionByToken(sessionToken: string, customDb?: Queryable): Promise<boolean> {
  if (!sessionToken?.trim()) return false
  const result = await db(customDb).query<{ id: number }>(
    `UPDATE web_sessions
     SET revoked_at = now()
     WHERE token_hash = $1 AND revoked_at IS NULL
     RETURNING id`,
    [sha256Hex(sessionToken.trim())]
  )
  return result.rows.length > 0
}

export async function revokeAllSessionsForUser(telegramId: number, customDb?: Queryable): Promise<number> {
  const result = await db(customDb).query<{ id: number }>(
    `UPDATE web_sessions
     SET revoked_at = now()
     WHERE telegram_id = $1::bigint AND revoked_at IS NULL
     RETURNING id`,
    [telegramId]
  )
  return result.rows.length
}

export function verifyCsrf(session: WebSessionRecord, csrfToken: string | undefined): boolean {
  if (!csrfToken?.trim()) return false
  return timingSafeEqualHex(session.csrf_hash, sha256Hex(csrfToken.trim()))
}

export function parseTelegramId(value: string | number): number {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value), 10)
  if (!Number.isFinite(n) || n <= 0) {
    const err = new Error('Invalid telegram_id in session') as Error & { status?: number }
    err.status = 401
    throw err
  }
  return n
}
