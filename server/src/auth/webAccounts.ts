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
  /** True when an active entitlement/subscription plan is lifetime (by plan_id). */
  isLifetime: boolean
  /** Most recent past end date when Premium is not currently active (for expired UI). */
  lastEndedAt: string | null
}

export type TelegramPremiumStatus = {
  isPremium: boolean
  activeUntil: string | null
  sources: SharedPremiumSource[]
  isLifetime: boolean
  lastEndedAt: string | null
}

function planIdIsLifetime(planId: string | null | undefined): boolean {
  const id = (planId || '').trim()
  return id === 'premium_lifetime' || id === 'premium_web_lifetime'
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
 * Receipt email this account itself typed at a paid checkout — only a prefill hint
 * for "confirm email" while the account has no verified address. Grants nothing.
 */
export async function getOwnReceiptEmailHint(
  webAccountId: string,
  customDb?: Queryable
): Promise<string | null> {
  const result = await db(customDb).query<{ receipt_email_normalized: string }>(
    `SELECT p.receipt_email_normalized
       FROM web_payments p
       JOIN web_accounts a ON a.id = p.web_account_id
      WHERE p.web_account_id = $1::uuid
        AND p.receipt_email_normalized IS NOT NULL
        AND p.premium_granted_at IS NOT NULL
        AND a.revoked_at IS NULL
        AND a.email_verified_at IS NULL
      ORDER BY p.paid_at DESC NULLS LAST, p.created_at DESC
      LIMIT 1`,
    [webAccountId]
  )
  return result.rows[0]?.receipt_email_normalized ?? null
}

/**
 * WEB purchase entitlements ($1 = account id) that belong to the account's verified
 * email but were bought from a guest account: the YooKassa receipt went to that
 * address. Rows stay on the paying account and payment, so webhook, confirm and
 * refunds keep acting on the original records; a refund/cancel revokes access here
 * too. Accounts with their own verified email are someone else's identity and are
 * never pulled in. Read-only: nothing is copied, extended or re-granted.
 */
export const EMAIL_CLAIMED_WEB_ENTITLEMENTS_SQL = `
  SELECT e.active_until, e.source, e.plan_id
    FROM web_accounts a
    JOIN web_payments p
      ON p.receipt_email_normalized = a.email_normalized
     AND p.premium_granted_at IS NOT NULL
     AND p.status IN ('succeeded', 'partially_refunded')
     AND p.web_account_id <> a.id
    JOIN web_accounts o ON o.id = p.web_account_id
    JOIN web_entitlements e
      ON e.payment_id = p.id
     AND e.web_account_id = p.web_account_id
     AND e.source = 'web_purchase'
   WHERE a.id = $1::uuid
     AND a.revoked_at IS NULL
     AND a.email_verified_at IS NOT NULL
     AND a.email_normalized IS NOT NULL
     AND o.revoked_at IS NULL
     AND (o.email_verified_at IS NULL OR o.email_normalized IS NULL)`

const VISIBLE_WEB_ENTITLEMENTS_SQL = `
  SELECT e.active_until, e.source, e.plan_id
    FROM web_entitlements e
   WHERE e.web_account_id = $1::uuid
     AND e.source IN ('web_purchase', 'manual_staging')
  UNION ALL
  ${EMAIL_CLAIMED_WEB_ENTITLEMENTS_SQL}`

/**
 * Effective Premium for a WEB account.
 * Own WEB purchases plus purchases claimed by the verified email (see
 * EMAIL_CLAIMED_WEB_ENTITLEMENTS_SQL); Telegram Premium is visible only while an
 * active verified link exists.
 * Copied telegram_link entitlement rows are audit-only — live subscriptions table is the source of truth.
 */
export type GetWebAccountPremiumOpts = {
  /** SHA-256 of gnh_web_device cookie. Required for telegram_subscription when device limit flag is on. */
  deviceTokenHash?: string | null
  /** When true, skip device-slot gate (internal/admin). Default false. */
  bypassDeviceGate?: boolean
}

export async function getWebAccountPremium(
  webAccountId: string,
  customDb?: Queryable,
  opts?: GetWebAccountPremiumOpts
): Promise<WebPremiumStatus> {
  const now = new Date()
  const sources = new Set<SharedPremiumSource>()
  let best: Date | null = null
  let isLifetime = false

  const entitlements = await db(customDb).query<{
    active_until: Date
    source: string
    plan_id: string | null
  }>(
    `SELECT v.active_until, v.source, v.plan_id
       FROM (${VISIBLE_WEB_ENTITLEMENTS_SQL}) v
      WHERE v.active_until > now()
      ORDER BY v.active_until DESC`,
    [webAccountId]
  )

  for (const row of entitlements.rows) {
    const until = new Date(row.active_until)
    best = pickBestUntil(best, until, now)
    if (row.source === 'web_purchase' || row.source === 'manual_staging') {
      sources.add(row.source)
    }
    if (planIdIsLifetime(row.plan_id)) isLifetime = true
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
    let deviceOk = true
    if (!opts?.bypassDeviceGate) {
      const { hasActiveDeviceForAccount, webDeviceLimitEnabled } = await import(
        './webTelegramDevices.js'
      )
      if (webDeviceLimitEnabled()) {
        deviceOk = await hasActiveDeviceForAccount(
          {
            webAccountId,
            deviceTokenHash: opts?.deviceTokenHash ?? null,
            telegramId: Number(telegramId),
          },
          customDb
        )
      }
    }
    if (deviceOk) {
      const sub = await db(customDb).query<{ active_until: Date; plan_id: string | null }>(
        `SELECT active_until, plan_id FROM subscriptions
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
        if (planIdIsLifetime(sub.rows[0]?.plan_id)) isLifetime = true
      }
    }
  }

  const isPremium = Boolean(best && best > now)
  let lastEndedAt: string | null = null
  if (!isPremium) {
    lastEndedAt = await fetchLastEndedAtForWeb(webAccountId, customDb)
  }

  return {
    isPremium,
    activeUntil: isPremium && best ? best.toISOString() : null,
    sources: [...sources],
    isLifetime: Boolean(isPremium && isLifetime),
    lastEndedAt,
  }
}

async function fetchLastEndedAtForWeb(
  webAccountId: string,
  customDb?: Queryable
): Promise<string | null> {
  const ended = await db(customDb).query<{ active_until: Date }>(
    `SELECT v.active_until
       FROM (${VISIBLE_WEB_ENTITLEMENTS_SQL}) v
      WHERE v.active_until <= now()
      ORDER BY v.active_until DESC
      LIMIT 1`,
    [webAccountId]
  )
  let best: Date | null = ended.rows[0]?.active_until
    ? new Date(ended.rows[0].active_until)
    : null

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
          AND active_until <= now()
        ORDER BY active_until DESC
        LIMIT 1`,
      [telegramId]
    )
    const until = sub.rows[0]?.active_until ? new Date(sub.rows[0].active_until) : null
    if (until && (!best || until > best)) best = until
  }
  return best ? best.toISOString() : null
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
  let isLifetime = false
  const tg = String(telegramId)

  const sub = await db(customDb).query<{ active_until: Date; plan_id: string | null }>(
    `SELECT active_until, plan_id FROM subscriptions
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
    if (planIdIsLifetime(sub.rows[0]?.plan_id)) isLifetime = true
  }

  const linkedWeb = await db(customDb).query<{
    active_until: Date
    source: string
    plan_id: string | null
  }>(
    `SELECT e.active_until, e.source, e.plan_id
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
    if (planIdIsLifetime(row.plan_id)) isLifetime = true
  }

  const isPremium = Boolean(best && best > now)
  let lastEndedAt: string | null = null
  if (!isPremium) {
    lastEndedAt = await fetchLastEndedAtForTelegram(tg, customDb)
  }

  return {
    isPremium,
    activeUntil: isPremium && best ? best.toISOString() : null,
    sources: [...sources],
    isLifetime: Boolean(isPremium && isLifetime),
    lastEndedAt,
  }
}

async function fetchLastEndedAtForTelegram(
  telegramId: string,
  customDb?: Queryable
): Promise<string | null> {
  const sub = await db(customDb).query<{ active_until: Date }>(
    `SELECT active_until FROM subscriptions
      WHERE telegram_id = $1::bigint
        AND active_until <= now()
      ORDER BY active_until DESC
      LIMIT 1`,
    [telegramId]
  )
  let best: Date | null = sub.rows[0]?.active_until
    ? new Date(sub.rows[0].active_until)
    : null

  const linkedWeb = await db(customDb).query<{ active_until: Date }>(
    `SELECT e.active_until
       FROM web_telegram_links l
       JOIN web_entitlements e ON e.web_account_id = l.web_account_id
      WHERE l.telegram_id = $1::bigint
        AND l.revoked_at IS NULL
        AND e.active_until <= now()
        AND e.source IN ('web_purchase', 'manual_staging')
      ORDER BY e.active_until DESC
      LIMIT 1`,
    [telegramId]
  )
  const webUntil = linkedWeb.rows[0]?.active_until
    ? new Date(linkedWeb.rows[0].active_until)
    : null
  if (webUntil && (!best || webUntil > best)) best = webUntil
  return best ? best.toISOString() : null
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
