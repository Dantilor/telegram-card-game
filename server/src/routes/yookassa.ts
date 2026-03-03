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

/**
 * Формирует чек по 54-ФЗ для ЮKassa.
 * Сумма в receipt.items должна совпадать с amount платежа.
 */
function buildReceipt(params: {
  customerEmail: string
  planTitle: string
  planId: string
  durationDays: number
  priceRub: number
}): { customer: { email: string }; items: Array<Record<string, unknown>> } {
  const amountValue = `${params.priceRub}.00`
  const months = Math.round(params.durationDays / 30)
  const description = `Подписка GameNight Host Premium (${months} мес.)`

  return {
    customer: { email: params.customerEmail },
    items: [
      {
        description,
        quantity: '1',
        amount: {
          value: amountValue,
          currency: 'RUB',
        },
        vat_code: 1, // без НДС
        payment_mode: 'full_payment',
        payment_subject: 'service',
      },
    ],
  }
}

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
    const planRow = await query<{ plan_id: string; title: string; price_rub: number; duration_days: number }>(
      `SELECT plan_id, title, price_rub, duration_days FROM plans WHERE plan_id = $1 AND is_active = true`,
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

    const email =
      typeof req.body?.email === 'string' && req.body.email.trim()
        ? String(req.body.email).trim()
        : `${telegramId}@gamenight.local`

    const receipt = buildReceipt({
      customerEmail: email,
      planTitle: plan.title,
      planId: plan.plan_id,
      durationDays: plan.duration_days,
      priceRub: plan.price_rub,
    })

    const description = `GameNight Host: ${plan.title} (${plan.plan_id})`
    const body = {
      amount: { value: amount, currency: 'RUB' },
      confirmation: { type: 'redirect' as const, return_url: returnUrl },
      capture: true,
      description,
      metadata: { telegram_id: String(telegramId), plan_id: plan.plan_id },
      receipt,
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
         telegram_id, plan_id, currency, total_amount,
         provider_payment_charge_id, telegram_payment_charge_id,
         invoice_payload, status
       ) VALUES ($1, $2, 'RUB', $3, $4, NULL, $5, 'pending')`,
      [
        telegramId,
        plan.plan_id,
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

type GrantPremiumResult =
  | { granted: true; telegramId: number; planId: string; activeUntil: Date }
  | { granted: false; alreadyDone?: boolean }

/**
 * Общая логика выдачи premium по paymentId. Используется в webhook и confirm.
 * Идемпотентно: если payments уже succeeded — просто возвращает alreadyDone.
 */
async function grantPremiumByPaymentId(
  paymentId: string,
  opts: {
    metadata?: { telegram_id?: string; plan_id?: string; telegramId?: string; planId?: string }
    bodyTelegramId?: number
  } = {}
): Promise<GrantPremiumResult> {
  const meta = opts.metadata ?? {}
  const metaTgRaw = meta.telegram_id ?? meta.telegramId
  const metaPlanId = (meta.plan_id ?? meta.planId)?.trim() || null

  let row: { id: number; status: string; telegram_id: number | null; plan_id: string | null } | undefined
  const existing = await query<{ id: number; status: string; telegram_id: number | null; plan_id: string | null }>(
    `SELECT id, status, telegram_id, plan_id FROM payments
     WHERE provider_payment_charge_id = $1 LIMIT 1`,
    [paymentId]
  )
  row = existing.rows[0]

  if (!row) {
    try {
      const byPayload = await query<{ id: number; status: string; telegram_id: number | null; plan_id: string | null }>(
        `SELECT id, status, telegram_id, plan_id FROM payments
         WHERE invoice_payload::text LIKE $1 LIMIT 1`,
        [`%${paymentId}%`]
      )
      row = byPayload.rows[0]
    } catch {
      // ignore
    }
  }

  if (row?.status === 'succeeded') {
    return { granted: false, alreadyDone: true }
  }

  const telegramId = row?.telegram_id ?? (opts.bodyTelegramId ?? (metaTgRaw ? parseInt(String(metaTgRaw), 10) : NaN))
  const planId = row?.plan_id ?? metaPlanId
  const resolvedTelegramId = Number.isFinite(telegramId) ? (telegramId as number) : null

  if (!resolvedTelegramId || !planId) {
    return { granted: false }
  }

  const planRow = await query<{ duration_days: number }>(
    `SELECT duration_days FROM plans WHERE plan_id = $1 AND is_active = true`,
    [planId]
  )
  const plan = planRow.rows[0]
  if (!plan) {
    return { granted: false }
  }

  await query(
    `UPDATE payments SET status = 'succeeded' WHERE provider_payment_charge_id = $1`,
    [paymentId]
  )

  await ensureUser(resolvedTelegramId)
  const now = new Date()
  const currentUntil = await getActiveSubscription(resolvedTelegramId, 'premium')
  const base = currentUntil && currentUntil > now ? currentUntil : now
  const activeUntil = new Date(base)
  activeUntil.setDate(activeUntil.getDate() + plan.duration_days)
  await upsertSubscription(resolvedTelegramId, 'premium', activeUntil)

  return { granted: true, telegramId: resolvedTelegramId, planId, activeUntil }
}

async function handleWebhook(req: Request, res: Response) {
  console.log('[YooKassa] webhook received', { event: req.body?.event, paymentId: req.body?.object?.id })

  const expected = process.env.YOOKASSA_WEBHOOK_SECRET
  if (!expected) {
    console.error('[YooKassa] YOOKASSA_WEBHOOK_SECRET is not set')
    res.status(500).json({ error: 'Webhook not configured' })
    return
  }

  const secret = req.headers['x-webhook-secret'] ?? req.query?.secret
  if (secret !== expected) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

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
  if (!obj) {
    res.status(200).json({ ok: true })
    return
  }

  const paymentId = obj.id
  const metadata = obj.metadata ?? {}
  const statusMap: Record<string, string> = {
    'payment.succeeded': 'succeeded',
    'payment.canceled': 'canceled',
    'payment.waiting_for_capture': 'waiting_for_capture',
    'payment.failed': 'failed',
  }
  const newStatus = eventType ? statusMap[eventType] : obj.status ? statusMap[`payment.${obj.status}`] ?? obj.status : null
  const isPaymentSucceeded = eventType === 'payment.succeeded' || (!eventType && obj.status === 'succeeded')

  const run = async () => {
    try {
      const pid = paymentId ?? ''
      if (!pid) return
      if (isPaymentSucceeded) {
        const result = await grantPremiumByPaymentId(pid, { metadata })
        if (result.granted) {
          console.log(`[YooKassa] webhook: premium granted paymentId=${pid} telegramId=${result.telegramId} planId=${result.planId} until=${result.activeUntil.toISOString()}`)
        }
      } else if (newStatus) {
        await query(
          `UPDATE payments SET status = $1 WHERE provider_payment_charge_id = $2`,
          [newStatus, pid]
        ).catch(() => {})
      }
    } catch (e) {
      console.error('[YooKassa] webhook error:', e)
    }
  }

  setImmediate(run)
  res.status(200).json({ ok: true })
}

async function handleConfirm(req: Request, res: Response) {
  const paymentIdRaw = req.body?.paymentId
  const telegramIdBodyRaw = req.body?.telegramId

  const paymentId = typeof paymentIdRaw === 'string' ? paymentIdRaw.trim() : ''
  const telegramIdBody =
    typeof telegramIdBodyRaw === 'number'
      ? telegramIdBodyRaw
      : typeof telegramIdBodyRaw === 'string' && telegramIdBodyRaw.trim()
        ? Number.parseInt(telegramIdBodyRaw.trim(), 10)
        : NaN

  if (!paymentId) {
    res.status(400).json({ ok: false, error: 'paymentId required' })
    return
  }

  const shopId = process.env.YOOKASSA_SHOP_ID
  const secretKey = process.env.YOOKASSA_SECRET_KEY
  if (!shopId || !secretKey) {
    console.error('[YooKassa] Missing YOOKASSA_SHOP_ID or YOOKASSA_SECRET_KEY')
    res.status(503).json({ ok: false, error: 'Payment not configured' })
    return
  }

  try {
    const ykRes = await fetch(`https://api.yookassa.ru/v3/payments/${encodeURIComponent(paymentId)}`, {
      method: 'GET',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64'),
        'Content-Type': 'application/json',
      },
    })

    if (!ykRes.ok) {
      const errText = await ykRes.text()
      console.error('[YooKassa] confirm API error:', ykRes.status, errText)
      res.status(502).json({ ok: false, error: 'Payment provider error' })
      return
    }

    const payment = (await ykRes.json()) as {
      id?: string
      status?: string
      metadata?: { telegram_id?: string; plan_id?: string; telegramId?: string; planId?: string }
    }

    const status = payment.status ?? null
    if (status !== 'succeeded') {
      res.status(200).json({ ok: false, status })
      return
    }

    const result = await grantPremiumByPaymentId(paymentId, {
      metadata: payment.metadata,
      bodyTelegramId: Number.isFinite(telegramIdBody) ? telegramIdBody : undefined,
    })

    if (result.granted) {
      console.log(
        `[YooKassa] confirm -> premium granted paymentId=${paymentId} telegramId=${result.telegramId} planId=${result.planId} until=${result.activeUntil.toISOString()}`
      )
      res.status(200).json({
        ok: true,
        status,
        paymentId,
        telegramId: result.telegramId,
        planId: result.planId,
        activeUntil: result.activeUntil.toISOString(),
      })
      return
    }

    if (result.alreadyDone) {
      res.status(200).json({ ok: true, status, paymentId, alreadyDone: true })
      return
    }

    res.status(400).json({ ok: false, error: 'Cannot resolve telegramId or planId' })
  } catch (e) {
    console.error('[YooKassa] confirm error:', e)
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
}

router.post('/payments/create', handleCreatePayment)
router.post('/payments/yookassa/create', handleCreatePayment)
// Standard webhook URL: POST /api/yookassa/webhook (Render: .../api/yookassa/webhook)
router.post('/yookassa/webhook', handleWebhook)
router.post('/payments/yookassa/webhook', handleWebhook) // alias (legacy)
router.post('/yookassa/confirm', handleConfirm)

export default router
