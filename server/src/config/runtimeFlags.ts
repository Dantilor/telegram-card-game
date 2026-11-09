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
