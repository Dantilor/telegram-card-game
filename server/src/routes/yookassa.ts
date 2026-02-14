import { Router, Request, Response } from 'express'
import { randomUUID } from 'node:crypto'
import { verifyInitData } from '../telegram/verifyInitData.js'
import { query } from '../db.js'
import { ensureUser, getActiveSubscription, upsertSubscription } from '../services/subscriptions.js'

function toInitDataString(v: unknown): string {
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v.join('')
  return ''
}

function getInitDataFromRequest(req: Request): string | null {
  const raw = req.headers['x-telegram-init-data'] ?? req.body?.initData ?? req.query?.initData ?? ''
  const s = toInitDataString(raw)
  return s?.trim() || null
}

function verifyAuth(req: Request, res: Response): number | null {
  const initData = getInitDataFromRequest(req)
  if (!initData) {
    res.status(401).json({ error: 'initData required' })
    return null
  }
  const botToken = process.env.TELEGRAM_BOT_TOKEN ?? process.env.BOT_TOKEN ?? ''
  try {
    const parsed = verifyInitData(initData, botToken)
    return parsed.telegram_id
  } catch {
    res.status(401).json({ error: 'Unauthorized' })
    return null
  }
}

const router = Router()
router.use((req, _res, next) => {
  (req as Request & { rawBody?: Buffer }).rawBody = undefined
  next()
})

async function handleCreatePayment(req: Request, res: Response) {
  const telegramId = verifyAuth(req, res)
  if (telegramId == null) return

  const planId = req.body?.planId
  if (typeof planId !== 'string' || !planId.trim()) {
    res.status(400).json({ ok: false, error: 'planId required' })
    return
  }

  const shopId = process.env.YOOKASSA_SHOP_ID
  const secretKey = process.env.YOOKASSA_SECRET_KEY
  const returnUrl = process.env.YOOKASSA_RETURN_URL
  if (!shopId || !secretKey || !returnUrl) {
    console.error('[YooKassa] Missing YOOKASSA_SHOP_ID, YOOKASSA_SECRET_KEY or YOOKASSA_RETURN_URL')
    res.status(503).json({ ok: false, error: 'Payment not configured' })
    return
  }

  try {
    const planRow = await query<{ id: string; title: string; price_rub: number; duration_days: number }>(
      `SELECT id, title, price_rub, duration_days FROM plans WHERE id = $1 AND is_active = true`,
      [planId.trim()]
    )
    const plan = planRow.rows[0]
    if (!plan) {
      res.status(400).json({ ok: false, error: 'Plan not found or inactive' })
      return
    }

    await ensureUser(telegramId)

    const idempotenceKey = randomUUID()
    const amount = `${plan.price_rub}.00`
    const description = `GameNight Host: ${plan.title} (${plan.id})`
    const body = {
      amount: { value: amount, currency: 'RUB' },
      confirmation: { type: 'redirect' as const, return_url: returnUrl },
      capture: true,
      description,
      metadata: { telegram_id: String(telegramId), plan_id: plan.id },
    }

    const yookassaRes = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64'),
        'Idempotence-Key': idempotenceKey,
      },
      body: JSON.stringify(body),
    })

    if (!yookassaRes.ok) {
      const errText = await yookassaRes.text()
      console.error('[YooKassa] API error:', yookassaRes.status, errText)
      res.status(502).json({ ok: false, error: 'Payment provider error' })
      return
    }

    const payment = (await yookassaRes.json()) as {
      id: string
      status: string
      confirmation?: { confirmation_url?: string }
    }
    const confirmationUrl = payment.confirmation?.confirmation_url
    if (!confirmationUrl) {
      console.error('[YooKassa] No confirmation_url in response')
      res.status(502).json({ ok: false, error: 'Invalid payment response' })
      return
    }

    await query(
      `INSERT INTO payments (
         telegram_id, provider, plan_id, currency, total_amount, amount,
         provider_payment_charge_id, telegram_payment_charge_id,
         invoice_payload, status
       ) VALUES ($1, 'yookassa', $2, 'RUB', $3, $3, $4, NULL, $5, 'pending')`,
      [
        telegramId,
        plan.id,
        plan.price_rub,
        payment.id,
        JSON.stringify(payment),
      ]
    )

    res.status(200).json({ confirmationUrl, paymentId: payment.id })
  } catch (e) {
    console.error('[YooKassa] create error:', e)
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
}

async function handleWebhook(req: Request, res: Response) {
  const expected = process.env.YOOKASSA_WEBHOOK_SECRET
  if (expected) {
    const secret = req.headers['x-webhook-secret'] ?? req.query?.secret
    if (secret !== expected) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
  }

  res.status(200).send('OK')

  const body = req.body as {
    type?: string
    event?: string
    object?: {
      id?: string
      status?: string
      metadata?: { telegram_id?: string; plan_id?: string; telegramId?: string; planId?: string }
    }
  }
  const eventType = body.event ?? body.type
  const obj = body.object
  if (!obj) return

  const paymentId = obj.id
  const metadata = obj.metadata ?? {}
  const telegramIdRaw = metadata.telegram_id ?? metadata.telegramId
  const planId = metadata.plan_id ?? metadata.planId
  const telegramId = telegramIdRaw ? parseInt(String(telegramIdRaw), 10) : null

  const statusMap: Record<string, string> = {
    'payment.succeeded': 'succeeded',
    'payment.canceled': 'canceled',
    'payment.waiting_for_capture': 'waiting_for_capture',
    'payment.failed': 'failed',
  }
  const newStatus = eventType ? statusMap[eventType] : obj.status ? statusMap[`payment.${obj.status}`] ?? obj.status : null

  const run = async () => {
    try {
      const existing = await query<{ id: number; status: string }>(
        `SELECT id, status FROM payments
         WHERE provider = 'yookassa' AND provider_payment_charge_id = $1`,
        [paymentId]
      )
      let row = existing.rows[0]

      if (!row && telegramId && planId) {
        const planRow = await query<{ duration_days: number; price_rub: number }>(
          `SELECT duration_days, price_rub FROM plans WHERE id = $1 AND is_active = true`,
          [planId]
        )
        const plan = planRow.rows[0]
        if (plan) {
          await ensureUser(telegramId)
          await query(
            `INSERT INTO payments (
               telegram_id, provider, plan_id, currency, total_amount, amount,
               provider_payment_charge_id, invoice_payload, status
             ) VALUES ($1, 'yookassa', $2, 'RUB', $3, $3, $4, $5, 'pending')
             ON CONFLICT (provider, provider_payment_charge_id) DO UPDATE SET id = payments.id
             RETURNING id, status`,
            [telegramId, planId, plan.price_rub, paymentId, JSON.stringify(obj)]
          )
          const r2 = await query<{ id: number; status: string }>(
            `SELECT id, status FROM payments
             WHERE provider = 'yookassa' AND provider_payment_charge_id = $1`,
            [paymentId]
          )
          row = r2.rows[0]
        }
      }

      if (!row) {
        if (newStatus) {
          await query(
            `UPDATE payments SET status = $1
             WHERE provider = 'yookassa' AND provider_payment_charge_id = $2`,
            [newStatus, paymentId]
          ).catch(() => {})
        }
        return
      }

      if (newStatus && newStatus !== row.status) {
        await query(
          `UPDATE payments SET status = $1 WHERE id = $2`,
          [newStatus, row.id]
        )
      }

      if (eventType === 'payment.succeeded' && row.status !== 'succeeded') {
        const planRow = await query<{ duration_days: number }>(
          `SELECT duration_days FROM plans WHERE id = $1 AND is_active = true`,
          [planId]
        )
        const plan = planRow.rows[0]
        if (!plan || !telegramId) return

        const now = new Date()
        const currentUntil = await getActiveSubscription(telegramId, 'premium')
        const base = currentUntil && currentUntil > now ? currentUntil : now
        const activeUntil = new Date(base)
        activeUntil.setDate(activeUntil.getDate() + plan.duration_days)

        await upsertSubscription(telegramId, 'premium', activeUntil)
        await query(`UPDATE payments SET status = 'succeeded' WHERE id = $1`, [row.id])

        console.log(`[YooKassa] webhook: premium activated telegramId=${telegramId} until=${activeUntil.toISOString()}`)
      }
    } catch (e) {
      console.error('[YooKassa] webhook error:', e)
    }
  }

  setImmediate(run)
}

router.post('/payments/create', handleCreatePayment)
router.post('/payments/yookassa/create', handleCreatePayment)
// Standard webhook URL: POST /api/yookassa/webhook (Render: .../api/yookassa/webhook)
router.post('/yookassa/webhook', handleWebhook)
router.post('/payments/yookassa/webhook', handleWebhook) // alias (legacy)

export default router
