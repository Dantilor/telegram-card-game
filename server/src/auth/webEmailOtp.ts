import type { Queryable } from '../legal/types.js'
import { query as defaultQuery } from '../db.js'
import { randomNumericCode, randomToken, sha256Hex } from './cryptoTokens.js'
import { sessionTtlMs } from './config.js'
import { getMailTransport } from '../services/mailTransport.js'
import { grantWebEntitlement } from './webAccounts.js'
import { consumeRateLimit } from './rateLimit.js'

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

export function normalizeEmail(raw: string): string | null {
  const v = raw.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || v.length > 320) return null
  return v
}

function otpCode(): string {
  return randomNumericCode(8)
}

const OTP_TTL_MS = 10 * 60_000
const MAX_ATTEMPTS = 5
const OTP_DIGITS_RE = /^\d{8}$/

export async function countRecentEmailOtps(
  emailNormalized: string,
  sinceMs: number,
  customDb?: Queryable
): Promise<number> {
  const since = new Date(Date.now() - sinceMs).toISOString()
  const result = await db(customDb).query<{ c: string }>(
    `SELECT count(*)::text AS c FROM web_email_otps
      WHERE email_normalized = $1 AND created_at >= $2::timestamptz`,
    [emailNormalized, since]
  )
  return Number(result.rows[0]?.c || 0)
}

async function insertAndSendOtp(input: {
  webAccountId: string
  emailNormalized: string
  purpose: 'bind' | 'recover'
  ip?: string | null
  db?: Queryable
}): Promise<{ expiresAt: Date; echoCode?: string }> {
  const ipKey = (input.ip || 'unknown').slice(0, 64)
  for (const key of [
    `email_otp_ip:${ipKey}`,
    `email_otp_email:${input.emailNormalized}`,
    `email_otp_account:${input.webAccountId}`,
  ]) {
    const limited = consumeRateLimit(key, key.startsWith('email_otp_ip:') ? 10 : 3, 60_000)
    if (!limited.ok) {
      const err = new Error('Too many codes') as Error & { status?: number; code?: string }
      err.status = 429
      err.code = 'rate_limited'
      throw err
    }
  }

  const recent = await countRecentEmailOtps(input.emailNormalized, 60_000, input.db)
  if (recent >= 3) {
    const err = new Error('Too many codes') as Error & { status?: number; code?: string }
    err.status = 429
    err.code = 'rate_limited'
    throw err
  }

  const code = otpCode()
  const expiresAt = new Date(Date.now() + OTP_TTL_MS)
  await db(input.db).query(
    `INSERT INTO web_email_otps (web_account_id, email_normalized, code_hash, purpose, expires_at)
     VALUES ($1::uuid, $2, $3, $4, $5)`,
    [input.webAccountId, input.emailNormalized, sha256Hex(code), input.purpose, expiresAt.toISOString()]
  )

  await getMailTransport().send({
    to: input.emailNormalized,
    subject: 'GameNight Host — код подтверждения',
    text: `Ваш код: ${code}\nДействует 10 минут.\nЕсли вы не запрашивали код, проигнорируйте письмо.`,
  })

  const echo =
    process.env.WEB_EMAIL_OTP_ECHO === '1' && process.env.NODE_ENV !== 'production'
      ? code
      : undefined

  return { expiresAt, echoCode: echo }
}

/** Bind email to the current anonymous WEB account. */
export async function startEmailBind(input: {
  webAccountId: string
  email: string
  ip?: string | null
  db?: Queryable
}): Promise<{ expiresAt: Date; echoCode?: string }> {
  const emailNormalized = normalizeEmail(input.email)
  if (!emailNormalized) {
    const err = new Error('Invalid email') as Error & { status?: number; code?: string }
    err.status = 400
    err.code = 'invalid_email'
    throw err
  }
  const taken = await db(input.db).query<{ id: string }>(
    `SELECT id FROM web_accounts
      WHERE email_normalized = $1 AND revoked_at IS NULL AND id <> $2::uuid
      LIMIT 1`,
    [emailNormalized, input.webAccountId]
  )
  if (taken.rows[0]) {
    const err = new Error('Email already linked') as Error & { status?: number; code?: string }
    err.status = 409
    err.code = 'email_taken'
    throw err
  }
  return insertAndSendOtp({
    webAccountId: input.webAccountId,
    emailNormalized,
    purpose: 'bind',
    ip: input.ip,
    db: input.db,
  })
}

/**
 * Start recover OTP. Always returns generic ok to avoid email enumeration.
 * Only sends mail when a verified email-bound account exists.
 */
export async function startEmailRecover(input: {
  email: string
  ip?: string | null
  db?: Queryable
}): Promise<{ ok: true; expiresAt?: string; echoCode?: string }> {
  const emailNormalized = normalizeEmail(input.email)
  if (!emailNormalized) {
    return { ok: true }
  }
  const ipLimited = consumeRateLimit(`email_recover_ip:${(input.ip || 'unknown').slice(0, 64)}`, 8, 60_000)
  if (!ipLimited.ok) {
    return { ok: true }
  }
  const account = await db(input.db).query<{ id: string }>(
    `SELECT id FROM web_accounts
      WHERE email_normalized = $1
        AND email_verified_at IS NOT NULL
        AND revoked_at IS NULL
      LIMIT 1`,
    [emailNormalized]
  )
  if (!account.rows[0]) {
    return { ok: true }
  }
  try {
    const started = await insertAndSendOtp({
      webAccountId: account.rows[0].id,
      emailNormalized,
      purpose: 'recover',
      ip: input.ip,
      db: input.db,
    })
    return {
      ok: true,
      expiresAt: started.expiresAt.toISOString(),
      echoCode: started.echoCode,
    }
  } catch (e) {
    const err = e as Error & { code?: string }
    if (err.code === 'rate_limited') return { ok: true }
    throw e
  }
}

export async function verifyEmailBind(input: {
  webAccountId: string
  email: string
  code: string
  db?: Queryable
}): Promise<{ emailNormalized: string }> {
  const emailNormalized = normalizeEmail(input.email)
  if (!emailNormalized || !OTP_DIGITS_RE.test(input.code.trim())) {
    const err = new Error('Invalid code or email') as Error & { status?: number; code?: string }
    err.status = 400
    err.code = 'invalid_code'
    throw err
  }

  const result = await db(input.db).query<{
    id: number
    web_account_id: string
    attempts: number
    expires_at: Date
    consumed_at: Date | null
  }>(
    `SELECT id, web_account_id, attempts, expires_at, consumed_at
       FROM web_email_otps
      WHERE email_normalized = $1
        AND purpose = 'bind'
        AND code_hash = $2
        AND web_account_id = $3::uuid
      ORDER BY id DESC
      LIMIT 1`,
    [emailNormalized, sha256Hex(input.code.trim()), input.webAccountId]
  )
  const row = result.rows[0]
  if (!row || row.consumed_at || new Date(row.expires_at).getTime() <= Date.now()) {
    const err = new Error('Code expired or unknown') as Error & { status?: number; code?: string }
    err.status = 400
    err.code = 'code_invalid'
    throw err
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    const err = new Error('Too many attempts') as Error & { status?: number; code?: string }
    err.status = 429
    err.code = 'rate_limited'
    throw err
  }
  await db(input.db).query(`UPDATE web_email_otps SET attempts = attempts + 1 WHERE id = $1`, [row.id])
  await db(input.db).query(
    `UPDATE web_email_otps SET consumed_at = now() WHERE id = $1 AND consumed_at IS NULL`,
    [row.id]
  )
  await db(input.db).query(
    `UPDATE web_accounts
        SET email_normalized = $2,
            email_verified_at = now(),
            last_seen_at = now()
      WHERE id = $1::uuid AND revoked_at IS NULL`,
    [input.webAccountId, emailNormalized]
  )
  return { emailNormalized }
}

export async function completeEmailRecover(input: {
  email: string
  code: string
  userAgent?: string | null
  db?: Queryable
}): Promise<{
  webAccountId: string
  sessionToken: string
  csrfToken: string
  expiresAt: Date
}> {
  const emailNormalized = normalizeEmail(input.email)
  if (!emailNormalized || !OTP_DIGITS_RE.test(input.code.trim())) {
    const err = new Error('Invalid code or email') as Error & { status?: number; code?: string }
    err.status = 400
    err.code = 'invalid_code'
    throw err
  }

  const result = await db(input.db).query<{
    id: number
    web_account_id: string
    attempts: number
    expires_at: Date
    consumed_at: Date | null
  }>(
    `SELECT id, web_account_id, attempts, expires_at, consumed_at
       FROM web_email_otps
      WHERE email_normalized = $1
        AND purpose = 'recover'
        AND code_hash = $2
      ORDER BY id DESC
      LIMIT 1`,
    [emailNormalized, sha256Hex(input.code.trim())]
  )
  const row = result.rows[0]
  if (!row || row.consumed_at || new Date(row.expires_at).getTime() <= Date.now()) {
    const err = new Error('Code expired or unknown') as Error & { status?: number; code?: string }
    err.status = 400
    err.code = 'code_invalid'
    throw err
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    const err = new Error('Too many attempts') as Error & { status?: number; code?: string }
    err.status = 429
    err.code = 'rate_limited'
    throw err
  }
  await db(input.db).query(`UPDATE web_email_otps SET attempts = attempts + 1 WHERE id = $1`, [row.id])
  await db(input.db).query(
    `UPDATE web_email_otps SET consumed_at = now() WHERE id = $1 AND consumed_at IS NULL`,
    [row.id]
  )

  const webAccountId = row.web_account_id
  const sessionToken = randomToken(32)
  const csrfToken = randomToken(32)
  const expiresAt = new Date(Date.now() + sessionTtlMs())
  const uaHash = input.userAgent ? sha256Hex(input.userAgent.slice(0, 512)) : null

  await db(input.db).query(
    `INSERT INTO web_sessions (token_hash, csrf_hash, web_account_id, expires_at, user_agent_hash)
     VALUES ($1, $2, $3::uuid, $4, $5)`,
    [sha256Hex(sessionToken), sha256Hex(csrfToken), webAccountId, expiresAt.toISOString(), uaHash]
  )

  return { webAccountId, sessionToken, csrfToken, expiresAt }
}

/** Staging helper: grant manual premium for E2E without payment. */
export async function grantManualStagingPremium(
  webAccountId: string,
  planId: string,
  activeUntil: Date,
  customDb?: Queryable
): Promise<void> {
  await grantWebEntitlement({
    webAccountId,
    planId,
    activeUntil,
    source: 'manual_staging',
    db: customDb,
  })
}
