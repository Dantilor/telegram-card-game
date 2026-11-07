export const TELEGRAM_OIDC_ISSUER = 'https://oauth.telegram.org'
export const TELEGRAM_OIDC_AUTH_URL = 'https://oauth.telegram.org/auth'
export const TELEGRAM_OIDC_TOKEN_URL = 'https://oauth.telegram.org/token'
export const TELEGRAM_OIDC_JWKS_URL = 'https://oauth.telegram.org/.well-known/jwks.json'

export const DEFAULT_OIDC_SCOPES = 'openid profile'

export function oidcClientId(): string {
  return (process.env.TELEGRAM_OIDC_CLIENT_ID ?? '').trim()
}

export function oidcClientSecret(): string {
  return (process.env.TELEGRAM_OIDC_CLIENT_SECRET ?? '').trim()
}

export function oidcRedirectUri(): string {
  return (process.env.TELEGRAM_OIDC_REDIRECT_URI ?? '').trim()
}

export function oidcScopes(): string {
  const raw = (process.env.TELEGRAM_OIDC_SCOPES ?? DEFAULT_OIDC_SCOPES).trim()
  return raw || DEFAULT_OIDC_SCOPES
}

export function webPublicOrigin(): string {
  return (process.env.WEB_PUBLIC_ORIGIN ?? '').trim().replace(/\/$/, '')
}

export function sessionTtlMs(): number {
  const hours = Number(process.env.WEB_SESSION_TTL_HOURS || 720)
  const safeHours = Number.isFinite(hours) && hours > 0 ? hours : 720
  return Math.floor(safeHours * 60 * 60 * 1000)
}

export function oidcStateTtlMs(): number {
  const minutes = Number(process.env.WEB_OIDC_STATE_TTL_MINUTES || 10)
  const safe = Number.isFinite(minutes) && minutes > 0 ? minutes : 10
  return Math.floor(safe * 60 * 1000)
}

export function assertOidcConfigured(): { clientId: string; clientSecret: string; redirectUri: string } {
  const clientId = oidcClientId()
  const clientSecret = oidcClientSecret()
  const redirectUri = oidcRedirectUri()
  if (!clientId || !clientSecret || !redirectUri) {
    const err = new Error('Telegram OIDC is not configured') as Error & { status?: number; code?: string }
    err.status = 503
    err.code = 'oidc_not_configured'
    throw err
  }
  return { clientId, clientSecret, redirectUri }
}
