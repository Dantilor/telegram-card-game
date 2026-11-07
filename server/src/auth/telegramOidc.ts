import { createRemoteJWKSet, jwtVerify, type JWTPayload, type CryptoKey } from 'jose'
import type { Queryable } from '../legal/types.js'
import { query as defaultQuery } from '../db.js'
import { ensureUser } from '../services/subscriptions.js'
import {
  TELEGRAM_OIDC_AUTH_URL,
  TELEGRAM_OIDC_ISSUER,
  TELEGRAM_OIDC_JWKS_URL,
  TELEGRAM_OIDC_TOKEN_URL,
  assertOidcConfigured,
  oidcRedirectUri,
  oidcScopes,
  oidcStateTtlMs,
} from './config.js'
import { pkceChallengeS256, randomToken, sha256Hex } from './cryptoTokens.js'

export type OidcIdTokenClaims = {
  telegramId: number
  sub: string
  name?: string
  preferredUsername?: string
  picture?: string
  exp: number
  iat: number
  nonce?: string
}

export type TelegramOidcDeps = {
  query?: Queryable
  fetchImpl?: typeof fetch
  /** Override JWKS verification (tests). */
  verifyIdToken?: (idToken: string, expected: { audience: string; nonce: string }) => Promise<OidcIdTokenClaims>
  jwksUrl?: string
  /** Local verification key for tests (skips remote JWKS). */
  localKey?: CryptoKey | Uint8Array
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

function authError(message: string, status = 401, code = 'oidc_invalid'): Error & { status: number; code: string } {
  const err = new Error(message) as Error & { status: number; code: string }
  err.status = status
  err.code = code
  return err
}

const remoteJwksByUrl = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

function getRemoteJwks(url: string) {
  let jwks = remoteJwksByUrl.get(url)
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(url))
    remoteJwksByUrl.set(url, jwks)
  }
  return jwks
}

/** Reset JWKS cache (tests). */
export function resetOidcJwksCache(): void {
  remoteJwksByUrl.clear()
}

export function extractTelegramIdFromClaims(payload: JWTPayload): number {
  const idClaim = payload.id
  if (typeof idClaim === 'number' && Number.isFinite(idClaim) && idClaim > 0) return idClaim
  if (typeof idClaim === 'string' && /^\d+$/.test(idClaim)) {
    const n = Number.parseInt(idClaim, 10)
    if (n > 0) return n
  }
  // Telegram docs: `id` is the Telegram user id when profile scope is present.
  // `sub` is a separate opaque subject — do not treat sub as telegram_id.
  throw authError('ID token missing Telegram user id', 401, 'oidc_missing_telegram_id')
}

export async function verifyTelegramIdToken(
  idToken: string,
  expected: { audience: string; nonce: string },
  deps: TelegramOidcDeps = {}
): Promise<OidcIdTokenClaims> {
  if (deps.verifyIdToken) {
    return deps.verifyIdToken(idToken, expected)
  }

  const key =
    deps.localKey ?? getRemoteJwks(deps.jwksUrl ?? TELEGRAM_OIDC_JWKS_URL)

  let payload: JWTPayload
  try {
    const verified = await jwtVerify(idToken, key, {
      issuer: TELEGRAM_OIDC_ISSUER,
      audience: expected.audience,
      algorithms: ['RS256', 'ES256', 'EdDSA', 'ES256K'],
      clockTolerance: 30,
    })
    payload = verified.payload
  } catch {
    throw authError('Invalid ID token signature or claims', 401, 'oidc_token_invalid')
  }

  if (typeof payload.exp !== 'number' || typeof payload.iat !== 'number') {
    throw authError('ID token missing exp/iat', 401, 'oidc_token_invalid')
  }
  if (payload.nonce !== expected.nonce) {
    throw authError('Invalid ID token nonce', 401, 'oidc_nonce_mismatch')
  }

  const telegramId = extractTelegramIdFromClaims(payload)
  return {
    telegramId,
    sub: String(payload.sub ?? ''),
    name: typeof payload.name === 'string' ? payload.name : undefined,
    preferredUsername:
      typeof payload.preferred_username === 'string' ? payload.preferred_username : undefined,
    picture: typeof payload.picture === 'string' ? payload.picture : undefined,
    exp: payload.exp,
    iat: payload.iat,
    nonce: typeof payload.nonce === 'string' ? payload.nonce : undefined,
  }
}

export type StartOidcResult = {
  authorizationUrl: string
  state: string
}

export async function startTelegramOidcLogin(
  opts?: { returnTo?: string | null; deps?: TelegramOidcDeps }
): Promise<StartOidcResult> {
  const { clientId, redirectUri } = assertOidcConfigured()
  const state = randomToken(24)
  const nonce = randomToken(24)
  const codeVerifier = randomToken(48)
  const codeChallenge = pkceChallengeS256(codeVerifier)
  const expiresAt = new Date(Date.now() + oidcStateTtlMs())
  const returnTo = sanitizeReturnTo(opts?.returnTo)

  await db(opts?.deps?.query).query(
    `INSERT INTO web_oidc_states (state, code_verifier, nonce, redirect_uri, return_to, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [state, codeVerifier, nonce, redirectUri, returnTo, expiresAt.toISOString()]
  )

  const url = new URL(TELEGRAM_OIDC_AUTH_URL)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', oidcScopes())
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge', codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('nonce', nonce)

  return { authorizationUrl: url.toString(), state }
}

function sanitizeReturnTo(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null
  if (trimmed.length > 512) return null
  return trimmed
}

type OidcStateRow = {
  state: string
  code_verifier: string
  nonce: string
  redirect_uri: string
  return_to: string | null
  expires_at: Date
  consumed_at: Date | null
}

export async function consumeOidcState(
  state: string,
  customDb?: Queryable
): Promise<OidcStateRow> {
  if (!state?.trim()) throw authError('Missing OIDC state', 400, 'oidc_state_missing')

  const claimed = await db(customDb).query<OidcStateRow>(
    `UPDATE web_oidc_states
     SET consumed_at = now()
     WHERE state = $1
       AND consumed_at IS NULL
       AND expires_at > now()
     RETURNING state, code_verifier, nonce, redirect_uri, return_to, expires_at, consumed_at`,
    [state.trim()]
  )
  const row = claimed.rows[0]
  if (!row) throw authError('Invalid or expired OIDC state', 401, 'oidc_state_invalid')
  return row
}

async function exchangeAuthorizationCode(
  input: {
    code: string
    redirectUri: string
    codeVerifier: string
    clientId: string
    clientSecret: string
  },
  fetchImpl: typeof fetch
): Promise<{ id_token: string }> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: input.code,
    redirect_uri: input.redirectUri,
    client_id: input.clientId,
    code_verifier: input.codeVerifier,
  })
  const basic = Buffer.from(`${input.clientId}:${input.clientSecret}`, 'utf8').toString('base64')
  const res = await fetchImpl(TELEGRAM_OIDC_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
      Accept: 'application/json',
    },
    body,
  })
  if (!res.ok) {
    throw authError('Telegram token exchange failed', 401, 'oidc_token_exchange_failed')
  }
  const json = (await res.json()) as { id_token?: unknown }
  if (typeof json.id_token !== 'string' || !json.id_token.trim()) {
    throw authError('Telegram token response missing id_token', 401, 'oidc_token_exchange_failed')
  }
  return { id_token: json.id_token }
}

async function markIdTokenConsumed(
  idToken: string,
  telegramId: number,
  exp: number,
  customDb?: Queryable
): Promise<void> {
  const tokenHash = sha256Hex(idToken)
  const expiresAt = new Date(Math.max(exp * 1000, Date.now() + 60_000))
  try {
    await db(customDb).query(
      `INSERT INTO web_oidc_token_replays (token_hash, telegram_id, expires_at)
       VALUES ($1, $2::bigint, $3)`,
      [tokenHash, telegramId, expiresAt.toISOString()]
    )
  } catch (e) {
    const code = e && typeof e === 'object' && 'code' in e ? String((e as { code?: string }).code) : ''
    if (code === '23505') {
      throw authError('Authorization result already used', 401, 'oidc_replay')
    }
    throw e
  }
}

export type CompleteOidcResult = {
  telegramId: number
  returnTo: string | null
  profile: {
    name?: string
    preferredUsername?: string
    picture?: string
  }
}

export async function completeTelegramOidcLogin(
  input: { code: string; state: string },
  deps: TelegramOidcDeps = {}
): Promise<CompleteOidcResult> {
  const { clientId, clientSecret } = assertOidcConfigured()
  const configuredRedirect = oidcRedirectUri()
  const stateRow = await consumeOidcState(input.state, deps.query)

  if (stateRow.redirect_uri !== configuredRedirect) {
    throw authError('OIDC redirect_uri mismatch', 401, 'oidc_redirect_mismatch')
  }
  if (!input.code?.trim()) {
    throw authError('Missing authorization code', 400, 'oidc_code_missing')
  }

  const fetchImpl = deps.fetchImpl ?? fetch
  const tokens = await exchangeAuthorizationCode(
    {
      code: input.code.trim(),
      redirectUri: stateRow.redirect_uri,
      codeVerifier: stateRow.code_verifier,
      clientId,
      clientSecret,
    },
    fetchImpl
  )

  const claims = await verifyTelegramIdToken(
    tokens.id_token,
    { audience: clientId, nonce: stateRow.nonce },
    deps
  )

  // Bind to existing users PK (telegram_id). Never creates a parallel identity store.
  await ensureUser(claims.telegramId, deps.query)
  await markIdTokenConsumed(tokens.id_token, claims.telegramId, claims.exp, deps.query)

  return {
    telegramId: claims.telegramId,
    returnTo: stateRow.return_to,
    profile: {
      name: claims.name,
      preferredUsername: claims.preferredUsername,
      picture: claims.picture,
    },
  }
}
