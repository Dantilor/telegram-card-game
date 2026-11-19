import type { Queryable } from '../legal/types.js'
import { query as defaultQuery } from '../db.js'
import { randomToken, sha256Hex } from './cryptoTokens.js'
import { sessionTtlMs } from './config.js'

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

export type CreatedAnonSession = {
  webAccountId: string
  sessionToken: string
  csrfToken: string
  expiresAt: Date
  created: boolean
}

/** Rate-limit helper: count recent account creations from this UA hash window. */
export async function countRecentAnonAccounts(
  sinceMs: number,
  customDb?: Queryable
): Promise<number> {
  const since = new Date(Date.now() - sinceMs).toISOString()
  const result = await db(customDb).query<{ c: string }>(
    `SELECT count(*)::text AS c FROM web_accounts WHERE created_at >= $1::timestamptz`,
    [since]
  )
  return Number(result.rows[0]?.c || 0)
}

export async function createAnonymousWebAccountSession(opts?: {
  userAgent?: string | null
  db?: Queryable
}): Promise<CreatedAnonSession> {
  const account = await db(opts?.db).query<{ id: string }>(
    `INSERT INTO web_accounts DEFAULT VALUES RETURNING id`
  )
  const webAccountId = account.rows[0]?.id
  if (!webAccountId) throw new Error('web_account_create_failed')

  const sessionToken = randomToken(32)
  const csrfToken = randomToken(32)
  const expiresAt = new Date(Date.now() + sessionTtlMs())
  const uaHash = opts?.userAgent ? sha256Hex(opts.userAgent.slice(0, 512)) : null

  await db(opts?.db).query(
    `INSERT INTO web_sessions (token_hash, csrf_hash, web_account_id, expires_at, user_agent_hash)
     VALUES ($1, $2, $3::uuid, $4, $5)`,
    [sha256Hex(sessionToken), sha256Hex(csrfToken), webAccountId, expiresAt.toISOString(), uaHash]
  )

  return {
    webAccountId,
    sessionToken,
    csrfToken,
    expiresAt,
    created: true,
  }
}

export type SharedPremiumSource =
  | 'web_purchase'
  | 'telegram_subscription'
  | 'manual_staging'

export type WebPremiumStatus = {
  isPremium: boolean
  activeUntil: string | null
  sources: SharedPremiumSource[]
}

export type TelegramPremiumStatus = {
  isPremium: boolean
  activeUntil: string | null
  sources: SharedPremiumSource[]
}

function pickBestUntil(current: Date | null, candidate: Date | null, now: Date): Date | null {
  if (!candidate || !(candidate > now)) return current
  if (!current || candidate > current) return candidate
  return current
}

/** Read-only contact already stored on the WEB account. Does not change bind or checkout. */
export async function getWebAccountContact(
  webAccountId: string,
  customDb?: Queryable
): Promise<{ email: string | null; emailVerified: boolean; emailPending: boolean }> {
  const result = await db(customDb).query<{
    email_normalized: string | null
    email_verified_at: Date | null
    pending_email_normalized: string | null
  }>(
    `SELECT email_normalized, email_verified_at, pending_email_normalized
       FROM web_accounts
      WHERE id = $1::uuid AND revoked_at IS NULL`,
    [webAccountId]
  )
  const row = result.rows[0]
  const emailVerified = Boolean(row?.email_verified_at && row.email_normalized)
  const pending = row?.pending_email_normalized ?? null
  return {
    email: emailVerified ? (row?.email_normalized ?? null) : pending ?? row?.email_normalized ?? null,
    emailVerified,
    emailPending: Boolean(pending) && !emailVerified,
  }
}

/**
 * Effective Premium for a WEB account.
 * Own WEB purchases stay local; Telegram Premium is visible only while an active verified link exists.
 * Copied telegram_link entitlement rows are audit-only — live subscriptions table is the source of truth.
 */
export async function getWebAccountPremium(
  webAccountId: string,
  customDb?: Queryable
): Promise<WebPremiumStatus> {
  const now = new Date()
  const sources = new Set<SharedPremiumSource>()
  let best: Date | null = null

  const entitlements = await db(customDb).query<{
    active_until: Date
    source: string
  }>(
    `SELECT e.active_until, e.source
       FROM web_entitlements e
      WHERE e.web_account_id = $1::uuid
        AND e.active_until > now()
        AND e.source IN ('web_purchase', 'manual_staging')
      ORDER BY e.active_until DESC`,
    [webAccountId]
  )

  for (const row of entitlements.rows) {
    const until = new Date(row.active_until)
    best = pickBestUntil(best, until, now)
    if (row.source === 'web_purchase' || row.source === 'manual_staging') {
      sources.add(row.source)
    }
  }

  const link = await db(customDb).query<{ telegram_id: string }>(
    `SELECT telegram_id::text
       FROM web_telegram_links
      WHERE web_account_id = $1::uuid AND revoked_at IS NULL
      LIMIT 1`,
    [webAccountId]
  )
  const telegramId = link.rows[0]?.telegram_id
  if (telegramId) {
    const sub = await db(customDb).query<{ active_until: Date }>(
      `SELECT active_until FROM subscriptions
        WHERE telegram_id = $1::bigint
          AND active_until > now()
        ORDER BY active_until DESC
        LIMIT 1`,
      [telegramId]
    )
    const until = sub.rows[0]?.active_until ? new Date(sub.rows[0].active_until) : null
    if (until && until > now) {
      best = pickBestUntil(best, until, now)
      sources.add('telegram_subscription')
    }
  }

  return {
    isPremium: Boolean(best && best > now),
    activeUntil: best ? best.toISOString() : null,
    sources: [...sources],
  }
}

/**
 * Effective Premium for a verified Telegram user.
 * Own subscriptions stay local; WEB purchases are visible only while an active verified link exists.
 * Does not copy WEB purchases into subscriptions (no duplicate grant / no re-link extension).
 */
export async function getTelegramPremium(
  telegramId: string | number,
  customDb?: Queryable
): Promise<TelegramPremiumStatus> {
  const now = new Date()
  const sources = new Set<SharedPremiumSource>()
  let best: Date | null = null
  const tg = String(telegramId)

  const sub = await db(customDb).query<{ active_until: Date }>(
    `SELECT active_until FROM subscriptions
      WHERE telegram_id = $1::bigint
        AND active_until > now()
      ORDER BY active_until DESC
      LIMIT 1`,
    [tg]
  )
  const subUntil = sub.rows[0]?.active_until ? new Date(sub.rows[0].active_until) : null
  if (subUntil && subUntil > now) {
    best = pickBestUntil(best, subUntil, now)
    sources.add('telegram_subscription')
  }

  const linkedWeb = await db(customDb).query<{
    active_until: Date
    source: string
  }>(
    `SELECT e.active_until, e.source
       FROM web_telegram_links l
       JOIN web_entitlements e ON e.web_account_id = l.web_account_id
      WHERE l.telegram_id = $1::bigint
        AND l.revoked_at IS NULL
        AND e.active_until > now()
        AND e.source IN ('web_purchase', 'manual_staging')
      ORDER BY e.active_until DESC`,
    [tg]
  )
  for (const row of linkedWeb.rows) {
    const until = new Date(row.active_until)
    best = pickBestUntil(best, until, now)
    if (row.source === 'web_purchase' || row.source === 'manual_staging') {
      sources.add(row.source)
    }
  }

  return {
    isPremium: Boolean(best && best > now),
    activeUntil: best ? best.toISOString() : null,
    sources: [...sources],
  }
}

export async function grantWebEntitlement(input: {
  webAccountId: string
  planId: string
  activeUntil: Date
  source: 'web_purchase' | 'telegram_link' | 'manual_staging'
  paymentId?: string | null
  linkedTelegramId?: number | null
  db?: Queryable
}): Promise<void> {
  await db(input.db).query(
    `INSERT INTO web_entitlements
      (web_account_id, plan_id, source, active_until, payment_id, linked_telegram_id, updated_at)
     VALUES ($1::uuid, $2, $3, $4, $5, $6, now())`,
    [
      input.webAccountId,
      input.planId,
      input.source,
      input.activeUntil.toISOString(),
      input.paymentId ?? null,
      input.linkedTelegramId ?? null,
    ]
  )
}

export async function touchWebAccount(webAccountId: string, customDb?: Queryable): Promise<void> {
  await db(customDb).query(`UPDATE web_accounts SET last_seen_at = now() WHERE id = $1::uuid`, [
    webAccountId,
  ])
}

/**
 * Expire telegram_link entitlements when a Telegram ID or WEB account loses the link.
 * Does not touch web_purchase / manual_staging or Telegram subscriptions.
 */
export async function revokeTelegramLinkEntitlements(input: {
  telegramId?: number | null
  webAccountId?: string | null
  exceptWebAccountId?: string | null
  db?: Queryable
}): Promise<number> {
  const result = await db(input.db).query<{ id: string }>(
    `UPDATE web_entitlements
        SET active_until = LEAST(active_until, now()),
            updated_at = now()
      WHERE source = 'telegram_link'
        AND active_until > now()
        AND (
          ($1::bigint IS NOT NULL AND linked_telegram_id = $1::bigint)
          OR ($2::uuid IS NOT NULL AND web_account_id = $2::uuid)
        )
        AND ($3::uuid IS NULL OR web_account_id <> $3::uuid)
      RETURNING id`,
    [input.telegramId ?? null, input.webAccountId ?? null, input.exceptWebAccountId ?? null]
  )
  return result.rows.length
}

/**
 * Expire web_purchase entitlements tied to a YooKassa payment after cancel/refund.
 */
export async function revokeWebPurchaseEntitlements(input: {
  paymentId: string
  db?: Queryable
}): Promise<number> {
  const paymentId = input.paymentId.trim()
  if (!paymentId) return 0
  const result = await db(input.db).query<{ id: string }>(
    `UPDATE web_entitlements
        SET active_until = LEAST(active_until, now()),
            updated_at = now()
      WHERE source = 'web_purchase'
        AND payment_id = $1
        AND active_until > now()
      RETURNING id`,
    [paymentId]
  )
  return result.rows.length
}
