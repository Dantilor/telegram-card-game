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

export type WebPremiumStatus = {
  isPremium: boolean
  activeUntil: string | null
  sources: Array<'web_purchase' | 'telegram_link' | 'telegram_subscription' | 'manual_staging'>
}

/**
 * Effective Premium for a WEB account: max(active_until) across web_entitlements
 * plus any active Telegram subscription via an active link.
 */
export async function getWebAccountPremium(
  webAccountId: string,
  customDb?: Queryable
): Promise<WebPremiumStatus> {
  const now = new Date()
  // telegram_link rows only count while an active matching link exists
  // (prevents Premium after unlink / transfer to another WEB account).
  const entitlements = await db(customDb).query<{
    active_until: Date
    source: string
  }>(
    `SELECT e.active_until, e.source
       FROM web_entitlements e
      WHERE e.web_account_id = $1::uuid
        AND e.active_until > now()
        AND (
          e.source <> 'telegram_link'
          OR EXISTS (
            SELECT 1 FROM web_telegram_links l
             WHERE l.web_account_id = e.web_account_id
               AND l.revoked_at IS NULL
               AND (
                 e.linked_telegram_id IS NULL
                 OR l.telegram_id = e.linked_telegram_id
               )
          )
        )
      ORDER BY e.active_until DESC`,
    [webAccountId]
  )

  const sources = new Set<WebPremiumStatus['sources'][number]>()
  let best: Date | null = null
  for (const row of entitlements.rows) {
    const until = new Date(row.active_until)
    if (!best || until > best) best = until
    if (
      row.source === 'web_purchase' ||
      row.source === 'telegram_link' ||
      row.source === 'manual_staging'
    ) {
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
        ORDER BY active_until DESC
        LIMIT 1`,
      [telegramId]
    )
    const until = sub.rows[0]?.active_until ? new Date(sub.rows[0].active_until) : null
    if (until && until > now) {
      if (!best || until > best) best = until
      sources.add('telegram_subscription')
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
