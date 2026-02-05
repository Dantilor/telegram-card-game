import { Router, Request, Response } from 'express'
import { verifyInitData } from '../telegram/verifyInitData.js'
import { getUserPremiumWithDb } from '../premiumStore.js'

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
    const { premium, premiumUntil, planId } = await getUserPremiumWithDb(telegramId)
    console.log(`[API] /api/me returns premium=${premium} planId=${planId ?? 'null'} premiumUntil=${premiumUntil ?? 'null'}`)
    res.status(200).json({
      telegramId,
      premium,
      planId: planId ?? undefined,
      activeUntil: premiumUntil ?? undefined,
      premiumUntil: premiumUntil ?? undefined,
    })
  } catch (e) {
    console.warn('[API] /api/me error:', e instanceof Error ? e.message : e)
    res.status(503).json({ error: 'Service temporarily unavailable' })
  }
})

export default router
