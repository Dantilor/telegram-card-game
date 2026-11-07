import type { NextFunction, Request, Response } from 'express'
import { resolveAuth, requireAuth, type ResolvedAuth, type ResolveAuthOptions } from './resolveAuth.js'

export type AuthedRequest = Request & { auth?: ResolvedAuth }

function sendAuthError(res: Response, e: unknown): void {
  const err = e as Error & { status?: number; code?: string }
  const status = err.status ?? 401
  res.status(status).json({
    error: status === 401 ? 'Unauthorized' : 'Auth error',
    code: err.code ?? 'unauthorized',
  })
}

/** Attach auth when present; does not fail if anonymous. */
export function optionalAuth(options: ResolveAuthOptions = {}) {
  return async (req: AuthedRequest, _res: Response, next: NextFunction) => {
    try {
      req.auth = (await resolveAuth(req, options)) ?? undefined
      next()
    } catch (e) {
      next(e)
    }
  }
}

/** Require Mini App initData or WEB session. */
export function requireAnyAuth(options: ResolveAuthOptions = {}) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      req.auth = await requireAuth(req, options)
      next()
    } catch (e) {
      sendAuthError(res, e)
    }
  }
}

/** Require WEB session specifically (ignores initData for the test/session endpoints). */
export function requireWebSession(options: ResolveAuthOptions = {}) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const auth = await requireAuth(req, { ...options, requireCsrfForWeb: false })
      if (auth.source !== 'web_session') {
        res.status(401).json({ error: 'Unauthorized', code: 'web_session_required' })
        return
      }
      req.auth = auth
      next()
    } catch (e) {
      sendAuthError(res, e)
    }
  }
}

/** Mutating WEB session routes: CSRF required when using cookie auth. */
export function requireAnyAuthWithCsrf(options: ResolveAuthOptions = {}) {
  return requireAnyAuth({ ...options, requireCsrfForWeb: true })
}
