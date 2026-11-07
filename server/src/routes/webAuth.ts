import { Router, type Request, type Response } from 'express'
import { ensureUser } from '../services/subscriptions.js'
import { webPublicOrigin, sessionTtlMs } from '../auth/config.js'
import {
  SESSION_COOKIE,
  clearSessionCookies,
  readCookies,
  setSessionCookies,
} from '../auth/cookies.js'
import { requireWebSession, type AuthedRequest } from '../auth/middleware.js'
import { resolveAuth } from '../auth/resolveAuth.js'
import { completeTelegramOidcLogin, startTelegramOidcLogin } from '../auth/telegramOidc.js'
import { createWebSession, revokeSessionByToken, verifyCsrf, findActiveSessionByToken } from '../auth/webSession.js'

const router = Router()

function errorPayload(e: unknown): { status: number; body: Record<string, unknown> } {
  const err = e as Error & { status?: number; code?: string }
  const status = err.status ?? 500
  return {
    status,
    body: {
      error: status === 401 ? 'Unauthorized' : status === 503 ? 'Service unavailable' : 'Auth error',
      code: err.code ?? (status === 401 ? 'unauthorized' : 'auth_error'),
      message: status >= 500 ? undefined : err.message,
    },
  }
}

function safeReturnPath(returnTo: string | null | undefined): string {
  if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//')) return '/'
  return returnTo
}

/**
 * Start Telegram OIDC Authorization Code + PKCE.
 * GET /api/web/auth/telegram/start?return_to=/
 */
router.get('/web/auth/telegram/start', async (req: Request, res: Response) => {
  try {
    const returnTo = typeof req.query.return_to === 'string' ? req.query.return_to : null
    const started = await startTelegramOidcLogin({ returnTo })
    const wantsRedirect =
      req.query.redirect === '1' ||
      req.query.redirect === 'true' ||
      (typeof req.headers.accept === 'string' && req.headers.accept.includes('text/html'))

    if (wantsRedirect) {
      res.redirect(302, started.authorizationUrl)
      return
    }
    res.status(200).json({
      ok: true,
      authorizationUrl: started.authorizationUrl,
      state: started.state,
    })
  } catch (e) {
    const { status, body } = errorPayload(e)
    res.status(status).json(body)
  }
})

/**
 * OIDC callback. Exchanges code, verifies id_token, creates WEB session cookies.
 * GET /api/web/auth/telegram/callback?code=&state=
 */
router.get('/web/auth/telegram/callback', async (req: Request, res: Response) => {
  try {
    const code = typeof req.query.code === 'string' ? req.query.code : ''
    const state = typeof req.query.state === 'string' ? req.query.state : ''
    const oidcError = typeof req.query.error === 'string' ? req.query.error : ''
    if (oidcError) {
      res.status(401).json({ error: 'Unauthorized', code: 'oidc_denied', message: oidcError })
      return
    }

    const completed = await completeTelegramOidcLogin({ code, state })
    await ensureUser(completed.telegramId)

    const session = await createWebSession(completed.telegramId, {
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
    })
    const maxAgeSec = Math.floor(sessionTtlMs() / 1000)
    setSessionCookies(res, {
      sessionToken: session.sessionToken,
      csrfToken: session.csrfToken,
      maxAgeSec,
    })

    const origin = webPublicOrigin()
    const path = safeReturnPath(completed.returnTo)
    if (origin) {
      res.redirect(302, `${origin}${path}`)
      return
    }

    res.status(200).json({
      ok: true,
      telegramId: completed.telegramId,
      source: 'web_session',
      returnTo: path,
      profile: completed.profile,
    })
  } catch (e) {
    const { status, body } = errorPayload(e)
    res.status(status).json(body)
  }
})

/** Logout: revoke session + clear cookies. Requires X-CSRF-Token matching the session. */
router.post('/web/auth/logout', async (req: Request, res: Response) => {
  try {
    const cookies = readCookies(req)
    const sessionToken = cookies[SESSION_COOKIE]
    if (!sessionToken) {
      clearSessionCookies(res)
      res.status(200).json({ ok: true })
      return
    }

    const session = await findActiveSessionByToken(sessionToken)
    if (session) {
      const headerCsrf =
        typeof req.headers['x-csrf-token'] === 'string' ? req.headers['x-csrf-token'].trim() : ''
      if (!verifyCsrf(session, headerCsrf)) {
        res.status(403).json({ error: 'CSRF validation failed', code: 'csrf_failed' })
        return
      }
      await revokeSessionByToken(sessionToken)
    }

    clearSessionCookies(res)
    res.status(200).json({ ok: true })
  } catch (e) {
    const { status, body } = errorPayload(e)
    res.status(status).json(body)
  }
})

/**
 * Test / foundation endpoint: WEB session only.
 * GET /api/web/session/me
 */
router.get('/web/session/me', requireWebSession(), async (req: AuthedRequest, res: Response) => {
  res.status(200).json({
    ok: true,
    telegramId: req.auth!.telegramId,
    source: req.auth!.source,
    sessionId: req.auth!.sessionId,
  })
})

/**
 * Dual-auth probe for Stage 2A (initData OR WEB session).
 * GET /api/web/auth/whoami
 */
router.get('/web/auth/whoami', async (req: Request, res: Response) => {
  try {
    const auth = await resolveAuth(req)
    if (!auth) {
      res.status(401).json({ error: 'Unauthorized', code: 'unauthorized' })
      return
    }
    res.status(200).json({
      ok: true,
      telegramId: auth.telegramId,
      source: auth.source,
      sessionId: auth.sessionId ?? null,
    })
  } catch (e) {
    const { status, body } = errorPayload(e)
    res.status(status).json(body)
  }
})

export default router
