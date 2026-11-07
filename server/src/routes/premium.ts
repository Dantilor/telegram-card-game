import { Router, Request, Response } from 'express'
import { query } from '../db.js'
import { resolveAuth } from '../auth/resolveAuth.js'

const QUERY_TIMEOUT_MS = 8000
const isDev = process.env.NODE_ENV !== 'production'

function safeResponse(
  res: Response,
  isPremium: boolean,
  activeUntil: string | null,
  extra?: Record<string, unknown>
) {
  res.status(200).json({ isPremium, activeUntil, ...extra })
}

const router = Router()

router.get('/premium-status', async (req: Request, res: Response) => {
  const auth = await resolveAuth(req)
  if (!auth) {
    if (isDev) console.log('[TCG] /premium-status: no auth')
    safeResponse(res, false, null)
    return
  }

  try {
    const telegram_id = auth.telegramId

    const queryPromise = query<{ active_until: Date }>(
      `SELECT active_until FROM subscriptions
       WHERE telegram_id = $1
       ORDER BY active_until DESC
       LIMIT 1`,
      [telegram_id]
    )
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Query timeout')), QUERY_TIMEOUT_MS)
    )
    const rows = await Promise.race([queryPromise, timeoutPromise])

    const sub = rows.rows[0]
    const now = new Date()
    const isPremium = !!sub && new Date(sub.active_until) > now
    const activeUntil = sub ? sub.active_until.toISOString() : null

    safeResponse(res, isPremium, activeUntil, { authSource: auth.source })
  } catch (e: unknown) {
    if (isDev) {
      const err = e instanceof Error ? e.message : String(e)
      console.warn('[TCG] /premium-status error:', err)
    }
    safeResponse(res, false, null)
  }
})

export default router
