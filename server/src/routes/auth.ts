import { Router } from 'express'
import { z } from 'zod'
import { verifyInitData } from '../telegram/verifyInitData.js'
import { query } from '../db.js'
import { finalizePendingReferral } from '../services/referrals.js'
import { registerAccount } from '../legal/consents.js'
import { LegalError, legalErrorBody } from '../legal/errors.js'
import { withTransaction } from '../legal/runtime.js'
import { accountRegistrationSchema } from './legal.js'

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

    if (req.body?.legal == null) {
      const existing = await query<{ telegram_id: string | number }>(
        `SELECT telegram_id FROM users WHERE telegram_id = $1::bigint`,
        [telegram_id]
      )
      if (existing.rows.length === 0) {
        res.status(409).json({
          error: 'agreement_required',
          message: 'Аккаунт создаётся вместе с явным принятием пользовательского соглашения.',
        })
        return
      }
    }

    if (req.body?.legal != null) {
      const parsed = accountRegistrationSchema.safeParse(req.body.legal)
      if (!parsed.success) {
        res.status(400).json({ error: 'invalid_body', message: 'Проверьте поля запроса.' })
        return
      }
      const registered = await registerAccount(withTransaction, telegram_id, parsed.data)
      try {
        await finalizePendingReferral(telegram_id)
      } catch (refErr) {
        console.warn('[auth] referral finalize failed:', refErr)
      }
      res.json({ telegramId: telegram_id, legal: registered })
      return
    }

    try {
      await finalizePendingReferral(telegram_id)
    } catch (refErr) {
      console.warn('[auth] referral finalize failed:', refErr)
    }

    res.json({ telegramId: telegram_id })
  } catch (e: unknown) {
    if (e instanceof LegalError) {
      res.status(e.status).json(legalErrorBody(e))
      return
    }
    const err = e as Error & { status?: number }
    const status = err.status ?? 500
    res.status(status).json({
      error: status === 401 ? 'Unauthorized' : 'Internal error',
    })
  }
})

export default router
