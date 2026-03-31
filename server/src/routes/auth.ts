import { Router } from 'express'
import { z } from 'zod'
import { verifyInitData } from '../telegram/verifyInitData.js'
import { query } from '../db.js'
import { finalizePendingReferral } from '../services/referrals.js'

const router = Router()

const AuthBodySchema = z.object({
  initData: z.string().min(1),
})

router.post('/auth', async (req, res) => {
  try {
    const parsed = AuthBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'initData required' })
      return
    }
    const { initData } = parsed.data
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

    try {
      await finalizePendingReferral(telegram_id)
    } catch (refErr) {
      console.warn('[auth] referral finalize failed:', refErr)
    }

    res.json({ telegramId: telegram_id })
  } catch (e: unknown) {
    const err = e as Error & { status?: number }
    const status = err.status ?? 500
    res.status(status).json({
      error: status === 401 ? 'Unauthorized' : 'Internal error',
    })
  }
})

export default router
