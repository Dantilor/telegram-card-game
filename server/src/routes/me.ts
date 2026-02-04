import { Router, Request, Response } from 'express'
import { verifyInitData } from '../telegram/verifyInitData.js'
import { query } from '../db/client.js'

const PREMIUM_PLAN_ID = 'premium_6m_259'

function getInitDataFromRequest(req: Request): string | null {
  const auth = req.headers.authorization
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim() || null
  const header = req.headers['x-telegram-init-data']
  if (typeof header === 'string' && header.trim()) return header.trim()
  const q = req.query.initData
  if (typeof q === 'string' && q.trim()) return q.trim()
  return null
}

const router = Router()

router.get('/api/me', async (req: Request, res: Response) => {
  try {
    const initData = getInitDataFromRequest(req)
    if (!initData) {
      res.status(401).json({ error: 'initData required' })
      return
    }
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      res.status(500).json({ error: 'Server misconfiguration' })
      return
    }

    const { telegram_id } = verifyInitData(initData, botToken)

    await query(
      `INSERT INTO users (telegram_id) VALUES ($1)
       ON CONFLICT (telegram_id) DO NOTHING`,
      [telegram_id]
    )

    const rows = await query<{ active_until: Date }>(
      `SELECT active_until FROM subscriptions
       WHERE telegram_id = $1 AND plan_id = $2`,
      [telegram_id, PREMIUM_PLAN_ID]
    )
    const sub = rows.rows[0]
    const now = new Date()
    const premium = !!sub && new Date(sub.active_until) > now
    const premiumUntil = sub ? sub.active_until.toISOString() : undefined

    res.json({ telegramId: telegram_id, premium, premiumUntil })
  } catch (e: unknown) {
    const err = e as Error & { status?: number }
    const status = err.status ?? 500
    res.status(status).json({
      error: status === 401 ? 'Unauthorized' : 'Internal error',
    })
  }
})

export default router
