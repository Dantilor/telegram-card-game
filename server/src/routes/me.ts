import { Router, Request, Response } from 'express'
import { verifyInitData } from '../telegram/verifyInitData.js'
import { query } from '../db.js'
import { getUser } from '../memoryStore.js'

function toInitDataString(v: unknown): string {
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v.join('')
  return ''
}

function getInitDataFromRequest(req: Request): string | null {
  const raw = req.headers['x-telegram-init-data'] ?? req.body?.initData ?? req.query?.initData
  const s = toInitDataString(raw)
  return s?.trim() || null
}

const router = Router()

router.get('/me', async (req: Request, res: Response) => {
  const initData = getInitDataFromRequest(req)
  if (!initData) {
    res.status(401).json({ error: 'initData required' })
    return
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN ?? process.env.BOT_TOKEN ?? ''
  let telegramId: number
  try {
    const parsed = verifyInitData(initData, botToken)
    telegramId = parsed.telegram_id
  } catch {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    await query(
      'INSERT INTO users (telegram_id) VALUES ($1) ON CONFLICT (telegram_id) DO NOTHING',
      [telegramId]
    )

    const subRes = await query<{ active_until: Date }>(
      `SELECT active_until FROM subscriptions
       WHERE telegram_id = $1 AND plan_id = 'premium'
       LIMIT 1`,
      [telegramId]
    )

    const row = subRes.rows[0]
    const activeUntil = row ? new Date(row.active_until) : null
    const isPremium = activeUntil ? activeUntil.getTime() > Date.now() : false
    const premiumUntil = activeUntil ? activeUntil.toISOString() : null

    res.status(200).json({
      telegramId,
      isPremium,
      premium: isPremium,
      premiumUntil,
      source: 'db',
    })
  } catch (e) {
    console.error('[API] /api/me DB error:', e)
    const mem = getUser(telegramId)
    const premiumUntilTs = mem?.premiumUntil
    const isPremium = premiumUntilTs != null && premiumUntilTs > Date.now()
    const premiumUntil = premiumUntilTs != null ? new Date(premiumUntilTs).toISOString() : null

    res.status(200).json({
      telegramId,
      isPremium,
      premium: isPremium,
      premiumUntil,
      source: 'memory',
      dbError: e instanceof Error ? e.message : String(e),
    })
  }
})

export default router
