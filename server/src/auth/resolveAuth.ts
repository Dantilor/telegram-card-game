import type { Request } from 'express'
import { verifyInitData } from '../telegram/verifyInitData.js'
import type { Queryable } from '../legal/types.js'
import { CSRF_COOKIE, SESSION_COOKIE, readCookies } from './cookies.js'
import {
  findActiveSessionByToken,
  parseTelegramId,
  touchSession,
  verifyCsrf,
} from './webSession.js'
import { touchWebAccount } from './webAccounts.js'

export type AuthSource = 'telegram_init_data' | 'web_session' | 'web_account'

export type ResolvedAuth = {
  /** Mini App / OIDC WEB session subject. Absent for anonymous WEB accounts. */
  telegramId?: number
  /** Anonymous or email-bound WEB account. Absent for Mini App initData. */
  webAccountId?: string
  source: AuthSource
  sessionId?: number
  /** Present for cookie sessions; used by CSRF checks on mutating routes. */
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
 * Dual/triple auth:
 * - Mini App initData (signature verified) → telegramId
 * - WEB OIDC session cookie → telegramId
 * - Anonymous WEB account cookie → webAccountId (never a fake telegram_id)
 * Client-supplied telegram_id / web_account_id is never trusted.
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
    await touchSession(session.id, options.db)
  }

  if (session.web_account_id) {
    if (!options.skipTouch) {
      await touchWebAccount(String(session.web_account_id), options.db).catch(() => {})
    }
    return {
      webAccountId: String(session.web_account_id),
      source: 'web_account',
      sessionId: session.id,
      csrfValid,
    }
  }

  if (session.telegram_id == null || session.telegram_id === '') {
    return null
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

/** Require a Telegram-backed subject (Mini App or OIDC WEB). Anonymous WEB accounts fail. */
export async function requireTelegramAuth(
  req: Request,
  options: ResolveAuthOptions = {}
): Promise<ResolvedAuth & { telegramId: number }> {
  const auth = await requireAuth(req, options)
  if (!auth.telegramId) {
    const err = new Error('Telegram auth required') as Error & { status?: number; code?: string }
    err.status = 401
    err.code = 'telegram_auth_required'
    throw err
  }
  return auth as ResolvedAuth & { telegramId: number }
}
