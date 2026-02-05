import { Router, Request, Response } from 'express'
import {
  adminGrantPremium,
  adminRevokePremium,
  getUserPremiumWithDb,
  getLastPaymentsDb,
} from '../premiumStore.js'

const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? ''

function requireAdmin(req: Request, res: Response, next: () => void): void {
  if (!ADMIN_TOKEN) {
    res.status(503).json({ error: 'ADMIN_TOKEN not configured' })
    return
  }
  const auth = req.headers.authorization
  const expected = `Bearer ${ADMIN_TOKEN}`
  if (!auth || auth.trim() !== expected) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  next()
}

const router = Router()
router.use(requireAdmin)

router.post('/grant', async (req: Request, res: Response) => {
  try {
    const telegramId = Number(req.body?.telegramId)
    if (!Number.isInteger(telegramId) || telegramId <= 0) {
      res.status(400).json({ error: 'telegramId required (positive integer)' })
      return
    }
    const months = Number.isFinite(Number(req.body?.months)) ? Number(req.body.months) : 6
    const days = Number.isFinite(Number(req.body?.days)) ? Number(req.body.days) : 0

    const { premiumUntil } = await adminGrantPremium(telegramId, { months, days })
    const premiumUntilIso = new Date(premiumUntil).toISOString()
    res.status(200).json({
      telegramId,
      premium: true,
      premiumUntil: premiumUntilIso,
    })
  } catch (e) {
    console.warn('[admin] grant error:', e instanceof Error ? e.message : e)
    res.status(503).json({ error: 'Service temporarily unavailable' })
  }
})

router.post('/revoke', async (req: Request, res: Response) => {
  try {
    const telegramId = Number(req.body?.telegramId)
    if (!Number.isInteger(telegramId) || telegramId <= 0) {
      res.status(400).json({ error: 'telegramId required (positive integer)' })
      return
    }

    await adminRevokePremium(telegramId)
    res.status(200).json({
      telegramId,
      premium: false,
    })
  } catch (e) {
    console.warn('[admin] revoke error:', e instanceof Error ? e.message : e)
    res.status(503).json({ error: 'Service temporarily unavailable' })
  }
})

router.get('/user/:telegramId', async (req: Request, res: Response) => {
  try {
    const telegramId = Number(req.params.telegramId)
    if (!Number.isInteger(telegramId) || telegramId <= 0) {
      res.status(400).json({ error: 'telegramId required (positive integer)' })
      return
    }

    const { premium, premiumUntil } = await getUserPremiumWithDb(telegramId)
    const payments = await getLastPaymentsDb(telegramId, 10)
    const lastPayments = payments.map((p) => ({
      id: p.id,
      planId: p.plan_id,
      currency: p.currency,
      totalAmount: p.total_amount,
      status: p.status,
      createdAt: new Date(p.created_at).toISOString(),
    }))

    res.status(200).json({
      telegramId,
      premium,
      premiumUntil: premiumUntil ?? null,
      lastPayments,
    })
  } catch (e) {
    console.warn('[admin] user error:', e instanceof Error ? e.message : e)
    res.status(503).json({ error: 'Service temporarily unavailable' })
  }
})

export default router
