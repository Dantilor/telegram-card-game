/**
 * Runtime safety flags for staging / production isolation.
 * Staging must never talk to production users, bots, or shops.
 */

export function isStagingRuntime(): boolean {
  return (
    process.env.GNH_STAGING === '1' ||
    process.env.GNH_STAGING === 'true' ||
    process.env.GNH_ENV === 'staging'
  )
}

export function isProductionLikeRuntime(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.GNH_PRODUCTION === '1' ||
    process.env.GNH_PRODUCTION === 'true' ||
    process.env.RENDER === 'true' ||
    Boolean(process.env.RENDER_EXTERNAL_URL) ||
    process.env.TIMEWEB === '1' ||
    process.env.TIMEWEB === 'true'
  )
}

/** Telegram bot webhook / outbound messaging must stay off on WEB staging. */
export function telegramBotSideEffectsDisabled(): boolean {
  if (isStagingRuntime()) return true
  return (
    process.env.GNH_DISABLE_TELEGRAM_BOT === '1' ||
    process.env.GNH_DISABLE_TELEGRAM_BOT === 'true'
  )
}

/** Admin marketing / broadcast to Telegram users. */
export function adminBroadcastDisabled(): boolean {
  if (telegramBotSideEffectsDisabled()) return true
  return (
    process.env.GNH_DISABLE_ADMIN_BROADCAST === '1' ||
    process.env.GNH_DISABLE_ADMIN_BROADCAST === 'true'
  )
}

export function serveWebStaticEnabled(): boolean {
  return process.env.GNH_SERVE_WEB_STATIC === '1' || process.env.GNH_SERVE_WEB_STATIC === 'true'
}

export function trustProxyHops(): number | false {
  const raw = (process.env.TRUST_PROXY ?? '').trim().toLowerCase()
  if (raw === '0' || raw === 'false' || raw === 'off') return false
  if (raw === '1' || raw === 'true' || raw === 'on') return 1
  if (/^\d+$/.test(raw)) return Number.parseInt(raw, 10)
  // Staging / production behind Timeweb or similar HTTPS terminator.
  if (isStagingRuntime() || isProductionLikeRuntime()) return 1
  return false
}

/**
 * Expected staging database name (path segment). Override with GNH_STAGING_DB_NAME.
 * Staging refuses gnh_supabase and any other name unless explicitly allowed.
 */
export function expectedStagingDatabaseName(): string {
  const raw = (process.env.GNH_STAGING_DB_NAME ?? 'gnh_web_staging').trim()
  return raw || 'gnh_web_staging'
}

export type StagingDbCheck =
  | { ok: true; database: string }
  | { ok: false; reason: string; database?: string }

/** Validate DATABASE_URL for staging boot. Never logs credentials. */
export function assertStagingDatabaseUrl(databaseUrl: string): StagingDbCheck {
  let pathname = ''
  try {
    pathname = new URL(databaseUrl).pathname.replace(/^\//, '')
  } catch {
    return { ok: false, reason: 'invalid_database_url' }
  }
  const database = pathname.split('/')[0] ?? ''
  if (!database) return { ok: false, reason: 'missing_database_name' }
  if (/gnh_supabase/i.test(database) || /gnh_supabase/i.test(databaseUrl)) {
    return { ok: false, reason: 'production_database_forbidden', database }
  }
  const expected = expectedStagingDatabaseName()
  if (database !== expected) {
    return {
      ok: false,
      reason: `database_name_mismatch: got "${database}", expected "${expected}" (set GNH_STAGING_DB_NAME to override)`,
      database,
    }
  }
  return { ok: true, database }
}
