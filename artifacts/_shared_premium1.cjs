const fs = require('fs')

// --- webAccounts.ts: refine getWebAccountPremium + add getTelegramPremium ---
{
  const p = 'server/src/auth/webAccounts.ts'
  let s = fs.readFileSync(p, 'utf8')

  const oldGetWeb = `export type WebPremiumStatus = {
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
    \`SELECT e.active_until, e.source
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
      ORDER BY e.active_until DESC\`,
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
    \`SELECT telegram_id::text
       FROM web_telegram_links
      WHERE web_account_id = $1::uuid AND revoked_at IS NULL
      LIMIT 1\`,
    [webAccountId]
  )
  const telegramId = link.rows[0]?.telegram_id
  if (telegramId) {
    const sub = await db(customDb).query<{ active_until: Date }>(
      \`SELECT active_until FROM subscriptions
        WHERE telegram_id = $1::bigint
        ORDER BY active_until DESC
        LIMIT 1\`,
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
}`

  const newBlock = `export type SharedPremiumSource =
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
    \`SELECT e.active_until, e.source
       FROM web_entitlements e
      WHERE e.web_account_id = $1::uuid
        AND e.active_until > now()
        AND e.source IN ('web_purchase', 'manual_staging')
      ORDER BY e.active_until DESC\`,
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
    \`SELECT telegram_id::text
       FROM web_telegram_links
      WHERE web_account_id = $1::uuid AND revoked_at IS NULL
      LIMIT 1\`,
    [webAccountId]
  )
  const telegramId = link.rows[0]?.telegram_id
  if (telegramId) {
    const sub = await db(customDb).query<{ active_until: Date }>(
      \`SELECT active_until FROM subscriptions
        WHERE telegram_id = $1::bigint
          AND active_until > now()
        ORDER BY active_until DESC
        LIMIT 1\`,
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
    \`SELECT active_until FROM subscriptions
      WHERE telegram_id = $1::bigint
        AND active_until > now()
      ORDER BY active_until DESC
      LIMIT 1\`,
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
    \`SELECT e.active_until, e.source
       FROM web_telegram_links l
       JOIN web_entitlements e ON e.web_account_id = l.web_account_id
      WHERE l.telegram_id = $1::bigint
        AND l.revoked_at IS NULL
        AND e.active_until > now()
        AND e.source IN ('web_purchase', 'manual_staging')
      ORDER BY e.active_until DESC\`,
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
}`

  if (!s.includes('export async function getTelegramPremium')) {
    if (!s.includes(oldGetWeb)) {
      // try softer replace by function start
      const start = s.indexOf('export type WebPremiumStatus = {')
      const end = s.indexOf('export async function grantWebEntitlement')
      if (start < 0 || end < 0) {
        console.error('markers missing for webAccounts replace', start, end)
        process.exit(1)
      }
      s = s.slice(0, start) + newBlock + '\n\n' + s.slice(end)
    } else {
      s = s.replace(oldGetWeb, newBlock)
    }
    fs.writeFileSync(p, s)
    console.log('webAccounts updated')
  } else {
    console.log('getTelegramPremium already present')
  }
}
