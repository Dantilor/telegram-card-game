import type { Request } from 'express'
import { verifyInitData } from '../telegram/verifyInitData.js'
import type { Queryable } from '../legal/types.js'
import { CSRF_COOKIE, SESSION_COOKIE, readCookies } from './cookies.js'
import { findActiveSessionByToken, parseTelegramId, touchSession, verifyCsrf } from './webSession.js'

export type AuthSource = 'telegram_init_data' | 'web_session'

export type ResolvedAuth = {
  telegramId: number
  source: AuthSource
  sessionId?: number
  /** Present for web_session; used by CSRF checks on mutating routes. */
  csrfValid?: boolean
}

export type ResolveAuthOptions = {
  /** Require CSRF when auth comes from a WEB session (mutating requests). */
  requireCsrfForWeb?: boolean
  db?: Queryable
  botToken?: string
  /** When true, skip sliding expiry extension. */
  skipTouch?: boolean
}

function toInitDataString(v: unknown): string {
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v.join('')
  return ''
}

/** Collect initData the same way existing Mini App routes do. Never trusts body.telegram_id. */
export function readInitDataFromRequest(req: Request): string | null {
  const auth = req.headers.authorization
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    const bearer = auth.slice(7).trim()
    if (bearer) return bearer
  }
  const header = req.headers['x-telegram-init-data']
  if (typeof header === 'string' && header.trim()) return header.trim()
  const bodyInit = req.method !== 'GET' ? (req.body as { initData?: unknown } | undefined)?.initData : undefined
  const fromBody = toInitDataString(bodyInit)
  if (fromBody.trim()) return fromBody.trim()
  const q = req.query?.initData
  if (typeof q === 'string' && q.trim()) return q.trim()
  return null
}

function readCsrfToken(req: Request, cookies: Record<string, string>): string | undefined {
  const header = req.headers['x-csrf-token']
  if (typeof header === 'string' && header.trim()) return header.trim()
  const fromCookie = cookies[CSRF_COOKIE]
  return fromCookie?.trim() || undefined
}

/**
 * Dual auth: Mini App initData (signature verified) OR WEB session cookie (DB verified).
 * Client-supplied telegram_id is never trusted.
 */
export async function resolveAuth(
  req: Request,
  options: ResolveAuthOptions = {}
): Promise<ResolvedAuth | null> {
  const botToken =
    options.botToken ?? process.env.TELEGRAM_BOT_TOKEN ?? process.env.BOT_TOKEN ?? ''

  const initData = readInitDataFromRequest(req)
  if (initData) {
    try {
      const parsed = verifyInitData(initData, botToken)
      return { telegramId: parsed.telegram_id, source: 'telegram_init_data' }
    } catch {
      // Fall through to WEB session only when initData was absent.
      // If the client sent initData but it is invalid, fail closed for that path.
      return null
    }
  }

  const cookies = readCookies(req)
  const sessionToken = cookies[SESSION_COOKIE]
  if (!sessionToken) return null

  const session = await findActiveSessionByToken(sessionToken, options.db)
  if (!session) return null

  const csrfToken = readCsrfToken(req, cookies)
  const csrfValid = verifyCsrf(session, csrfToken)

  if (options.requireCsrfForWeb && !csrfValid) {
    return null
  }

  if (!options.skipTouch) {
    // Sliding renewal: refresh expires_at on each successful resolve.
    await touchSession(session.id, options.db)
  }

  return {
    telegramId: parseTelegramId(session.telegram_id),
    source: 'web_session',
    sessionId: session.id,
    csrfValid,
  }
}

export async function requireAuth(
  req: Request,
  options: ResolveAuthOptions = {}
): Promise<ResolvedAuth> {
  const auth = await resolveAuth(req, options)
  if (!auth) {
    const err = new Error('Unauthorized') as Error & { status?: number; code?: string }
    err.status = 401
    err.code = 'unauthorized'
    throw err
  }
  return auth
}
