import { Router, Request, Response } from 'express'
import { verifyInitData } from '../telegram/verifyInitData.js'
import { getUser, isPremium } from '../memoryStore.js'

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

router.get('/me', async (req: Request, res: Response) => {
  const initData = getInitDataFromRequest(req)
  if (!initData) {
    res.status(401).json({ error: 'initData required' })
    return
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN ?? ''
  let telegram_id: number
  try {
    const parsed = verifyInitData(initData, botToken)
    telegram_id = parsed.telegram_id
  } catch {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const user = getUser(telegram_id)
    const premium = isPremium(telegram_id)
    const premiumUntil = user?.premiumUntil ? new Date(user.premiumUntil).toISOString() : null
    console.log(`[API] /api/me returns premium=${premium} premiumUntil=${premiumUntil ?? 'null'}`)
    res.status(200).json({ telegramId: telegram_id, premium, premiumUntil })
  } catch (e) {
    console.warn('[DB] unavailable, fallback:', e instanceof Error ? e.message : e)
    const fallbackUser = getUser(telegram_id)
    const fallbackPremium = fallbackUser?.premiumUntil ? fallbackUser.premiumUntil > Date.now() : false
    const fallbackUntil = fallbackUser?.premiumUntil ? new Date(fallbackUser.premiumUntil).toISOString() : null
    res.status(200).json({ telegramId: telegram_id, premium: fallbackPremium, premiumUntil: fallbackUntil })
  }
})

export default router
