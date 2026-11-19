import { Router, type Request, type Response } from 'express'
import { resolveAuth } from '../auth/resolveAuth.js'
import {
  acquireGameSessionLease,
  gameSessionLimitEnabled,
  GAME_SESSION_LIMIT,
  GAME_SESSION_TTL_MS,
  heartbeatGameSessionLease,
  releaseGameSessionLease,
  statusGameSessionLeases,
} from '../auth/gameSessionLeases.js'

const router = Router()

function errorPayload(e: unknown): { status: number; body: Record<string, unknown> } {
  const err = e as Error & { status?: number; code?: string }
  const status = err.status ?? 500
  return {
    status,
    body: {
      error: status === 409 ? 'Conflict' : status === 401 ? 'Unauthorized' : 'Game session error',
      code: err.code ?? 'game_session_error',
      message: status >= 500 ? undefined : err.message,
      limit: err.code === 'game_session_limit_reached' ? GAME_SESSION_LIMIT : undefined,
    },
  }
}

async function requireAuth(req: Request, res: Response, csrf: boolean) {
  const auth = await resolveAuth(req, { requireCsrfForWeb: csrf })
  if (!auth || (!auth.webAccountId && !auth.telegramId)) {
    res.status(401).json({ error: 'Unauthorized', code: 'unauthorized' })
    return null
  }
  return auth
}

/** GET /api/game-sessions/status */
router.get('/game-sessions/status', async (req: Request, res: Response) => {
  try {
    if (!gameSessionLimitEnabled()) {
      res.status(200).json({
        ok: true,
        enabled: false,
        activeCount: 0,
        limit: GAME_SESSION_LIMIT,
        ttlMs: GAME_SESSION_TTL_MS,
      })
      return
    }
    const auth = await requireAuth(req, res, false)
    if (!auth) return
    const status = await statusGameSessionLeases({ auth })
    res.status(200).json({
      ok: true,
      enabled: true,
      activeCount: status.active_count,
      limit: status.limit,
      ttlMs: GAME_SESSION_TTL_MS,
    })
  } catch (e) {
    const { status, body } = errorPayload(e)
    res.status(status).json(body)
  }
})

/** POST /api/game-sessions/acquire { clientLeaseId, gameId } */
router.post('/game-sessions/acquire', async (req: Request, res: Response) => {
  try {
    if (!gameSessionLimitEnabled()) {
      res.status(200).json({
        ok: true,
        enabled: false,
        activeCount: 0,
        limit: GAME_SESSION_LIMIT,
        ttlMs: GAME_SESSION_TTL_MS,
      })
      return
    }
    const auth = await requireAuth(req, res, true)
    if (!auth) return
    const clientLeaseId = typeof req.body?.clientLeaseId === 'string' ? req.body.clientLeaseId : ''
    const gameId = typeof req.body?.gameId === 'string' ? req.body.gameId : ''
    const lease = await acquireGameSessionLease({ auth, clientLeaseId, gameId })
    res.status(200).json({
      ok: true,
      enabled: true,
      leaseId: lease.id,
      clientLeaseId: lease.client_lease_id,
      gameId: lease.game_id,
      expiresAt: lease.expires_at.toISOString(),
      activeCount: lease.active_count,
      limit: GAME_SESSION_LIMIT,
      ttlMs: GAME_SESSION_TTL_MS,
    })
  } catch (e) {
    const { status, body } = errorPayload(e)
    res.status(status).json(body)
  }
})

/** POST /api/game-sessions/heartbeat { clientLeaseId } */
router.post('/game-sessions/heartbeat', async (req: Request, res: Response) => {
  try {
    if (!gameSessionLimitEnabled()) {
      res.status(200).json({ ok: true, enabled: false })
      return
    }
    const auth = await requireAuth(req, res, true)
    if (!auth) return
    const clientLeaseId = typeof req.body?.clientLeaseId === 'string' ? req.body.clientLeaseId : ''
    const lease = await heartbeatGameSessionLease({ auth, clientLeaseId })
    res.status(200).json({
      ok: true,
      enabled: true,
      leaseId: lease.id,
      expiresAt: lease.expires_at.toISOString(),
      activeCount: lease.active_count,
      limit: GAME_SESSION_LIMIT,
      ttlMs: GAME_SESSION_TTL_MS,
    })
  } catch (e) {
    const { status, body } = errorPayload(e)
    res.status(status).json(body)
  }
})

/** POST /api/game-sessions/release { clientLeaseId } */
router.post('/game-sessions/release', async (req: Request, res: Response) => {
  try {
    if (!gameSessionLimitEnabled()) {
      res.status(200).json({ ok: true, enabled: false, released: false })
      return
    }
    const auth = await requireAuth(req, res, true)
    if (!auth) return
    const clientLeaseId = typeof req.body?.clientLeaseId === 'string' ? req.body.clientLeaseId : ''
    const result = await releaseGameSessionLease({ auth, clientLeaseId })
    res.status(200).json({
      ok: true,
      enabled: true,
      released: result.released,
      activeCount: result.active_count,
      limit: GAME_SESSION_LIMIT,
    })
  } catch (e) {
    const { status, body } = errorPayload(e)
    res.status(status).json(body)
  }
})

export default router