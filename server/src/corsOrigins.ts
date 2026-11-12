/**
 * Build the allow-list for browser CORS.
 *
 * Browser `Origin` never includes a path. Operators sometimes paste the full
 * Mini App URL (with `/telegram-card-game/`) into CORS_ORIGIN / WEBAPP_URL —
 * those entries would never match and Telegram WebView would see
 * "Failed to fetch" for /api/plans and the offer document even though curl works.
 */
export function originFromUrl(value: string | undefined): string | null {
  const raw = (value ?? '').trim()
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.origin
  } catch {
    return null
  }
}

export function buildAllowedCorsOrigins(env: {
  CORS_ORIGIN?: string
  WEBAPP_URL?: string
}): string[] {
  const fromCors = (env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((part) => originFromUrl(part))
    .filter((value): value is string => Boolean(value))

  const fromWebApp = originFromUrl(env.WEBAPP_URL)

  const defaults = [
    'http://localhost:4173',
    'http://localhost:5173',
    'http://127.0.0.1:4173',
    'http://127.0.0.1:5173',
    // Published GitHub Pages Mini App origin (path is not part of Origin).
    'https://dantilor.github.io',
  ]

  return [...new Set([...fromCors, ...(fromWebApp ? [fromWebApp] : []), ...defaults])]
}

export function isOriginAllowed(origin: string | undefined, allowed: readonly string[]): boolean {
  if (!origin) return true
  return allowed.includes(origin)
}
