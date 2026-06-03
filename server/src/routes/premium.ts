import { Router, Request, Response } from 'express'
import { verifyInitData } from '../telegram/verifyInitData.js'
import { query } from '../db.js'

const QUERY_TIMEOUT_MS = 8000
const isDev = process.env.NODE_ENV !== 'production'

function getInitDataFromRequest(req: Request): string | null {
  const auth = req.headers.authorization
  if (auth?.startsWith('Bearer ')) {
    return auth.slice(7).trim() || null
  }
  const header = req.headers['x-telegram-init-data']
  if (typeof header === 'string' && header.trim()) return header.trim()
  const q = req.query.initData
  if (typeof q === 'string' && q.trim()) return q.trim()
  return null
}

function safeResponse(res: Response, isPremium: boolean, activeUntil: string | null) {
  res.status(200).json({ isPremium, activeUntil })
}

const router = Router()

router.get('/premium-status', async (req: Request, res: Response) => {
  const initData = getInitDataFromRequest(req)
  if (!initData) {
    if (isDev) console.log('[TCG] /premium-status: no initData')
    safeResponse(res, false, null)
    return
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    if (isDev) console.warn('[TCG] /premium-status: TELEGRAM_BOT_TOKEN not set')
    safeResponse(res, false, null)
    return
  }

  try {
    const { telegram_id } = verifyInitData(initData, botToken)

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

    safeResponse(res, isPremium, activeUntil)
  } catch (e: unknown) {
    if (isDev) {
      const err = e instanceof Error ? e.message : String(e)
      console.warn('[TCG] /premium-status error:', err)
    }
    safeResponse(res, false, null)
  }
})

export default router
