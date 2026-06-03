import { Router, Request, Response } from 'express'
import { randomUUID } from 'node:crypto'
import { verifyInitData } from '../telegram/verifyInitData.js'
import { query } from '../db.js'
import {
  ensureUser,
  extendPremiumActiveUntil,
  logPgError,
} from '../services/subscriptions.js'
import { getActivePlanById, getPlanDurationDays, planReceiptDescription } from '../services/plans.js'
import { normalizeTelegramId, resolvePlanIdForGrant, resolveTelegramIdForGrant } from '../utils/telegramId.js'

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
  const description = planReceiptDescription(params.durationDays)

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
    const plan = await getActivePlanById(planId.trim())
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
      metadata: {
        telegram_id: String(telegramId),
        userId: String(telegramId),
        plan_id: plan.plan_id,
        planId: plan.plan_id,
      },
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
         telegram_id,
         plan_id,
         currency,
         total_amount,
         provider_payment_charge_id,
         status
       ) VALUES ($1, $2, 'RUB', $3, $4, 'pending')`,
      [telegramId, plan.plan_id, plan.price_rub, payment.id]
    )

    res.status(200).json({ confirmationUrl, paymentId: payment.id })
  } catch (e) {
    console.error('[YooKassa] create error:', e)
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
}

type PaymentGrantRow = {
  id: number
  status: string
  telegram_id: string | number | null
  plan_id: string | null
  premium_granted_at: Date | null
}

type GrantPremiumResult =
  | { granted: true; telegramId: string; planId: string; activeUntil: Date }
  | { granted: false; alreadyDone?: boolean; reason?: string }

function logGrantFailure(paymentId: string, reason: string, details: Record<string, unknown>): void {
  console.error(`[YooKassa] grantPremium: ${reason} paymentId=${paymentId}`, details)
}

async function findPaymentGrantRow(paymentId: string): Promise<PaymentGrantRow | undefined> {
  const existing = await query<PaymentGrantRow>(
    `SELECT id, status, telegram_id, plan_id, premium_granted_at
     FROM payments
     WHERE provider_payment_charge_id = $1
     LIMIT 1`,
    [paymentId]
  )
  if (existing.rows[0]) return existing.rows[0]

  try {
    const byPayload = await query<PaymentGrantRow>(
      `SELECT id, status, telegram_id, plan_id, premium_granted_at
       FROM payments
       WHERE invoice_payload::text LIKE $1
       LIMIT 1`,
      [`%${paymentId}%`]
    )
    return byPayload.rows[0]
  } catch {
    return undefined
  }
}

/** Атомарно «захватывает» платёж для выдачи premium. Возвращает строку только один раз на paymentId. */
async function claimPaymentForPremiumGrant(paymentId: string): Promise<PaymentGrantRow | null> {
  const res = await query<PaymentGrantRow>(
    `UPDATE payments
     SET premium_granted_at = now()
     WHERE provider_payment_charge_id = $1
       AND premium_granted_at IS NULL
     RETURNING id, status, telegram_id, plan_id, premium_granted_at`,
    [paymentId]
  )
  return res.rows[0] ?? null
}

async function releasePaymentGrantClaim(paymentId: string): Promise<void> {
  await query(
    `UPDATE payments
     SET premium_granted_at = NULL
     WHERE provider_payment_charge_id = $1
       AND premium_granted_at IS NOT NULL`,
    [paymentId]
  )
}

async function finalizePaymentGrant(paymentId: string): Promise<void> {
  await query(
    `UPDATE payments
     SET status = 'succeeded',
         premium_granted_at = COALESCE(premium_granted_at, now())
     WHERE provider_payment_charge_id = $1`,
    [paymentId]
  )
}

async function ensurePaymentRowForGrant(
  paymentId: string,
  telegramId: string,
  planId: string
): Promise<void> {
  await query(
    `INSERT INTO payments (
       telegram_id,
       plan_id,
       provider,
       provider_payment_charge_id,
       status,
       currency
     )
     VALUES ($1::bigint, $2, 'yookassa', $3, 'pending', 'RUB')
     ON CONFLICT (provider, provider_payment_charge_id) DO NOTHING`,
    [telegramId, planId, paymentId]
  )
}

/**
 * Общая логика выдачи premium по paymentId. Используется в webhook и confirm.
 * Идемпотентно: premium выдаётся один раз на provider_payment_charge_id (premium_granted_at).
 * Старые платежи со status=succeeded, но без premium_granted_at, можно обработать повторно.
 */
async function grantPremiumByPaymentId(
  paymentId: string,
  opts: {
    metadata?: { telegram_id?: string; plan_id?: string; telegramId?: string; planId?: string; userId?: string }
    bodyTelegramId?: string | number
  } = {}
): Promise<GrantPremiumResult> {
  const meta = opts.metadata ?? {}
  const metaPlanId = (meta.plan_id ?? meta.planId)?.trim() || null

  const existingRow = await findPaymentGrantRow(paymentId)
  if (existingRow?.premium_granted_at) {
    console.log('[YooKassa] grantPremium: already processed', {
      paymentId,
      premiumGrantedAt: existingRow.premium_granted_at.toISOString(),
      status: existingRow.status,
    })
    return { granted: false, alreadyDone: true, reason: 'already processed' }
  }

  const resolvedTelegramId = resolveTelegramIdForGrant({
    rowTelegramId: existingRow?.telegram_id,
    bodyTelegramId: opts.bodyTelegramId,
    metaTelegramId: meta.telegram_id,
    metaTelegramIdAlt: meta.telegramId,
  })
  const planId = resolvePlanIdForGrant({
    rowPlanId: existingRow?.plan_id,
    metaPlanId: meta.plan_id,
    metaPlanIdAlt: meta.planId,
  })

  if (!resolvedTelegramId || !planId) {
    logGrantFailure(paymentId, 'missing telegramId or planId', {
      hasRow: !!existingRow,
      rowStatus: existingRow?.status ?? null,
      rowTelegramId: existingRow?.telegram_id ?? null,
      rowPlanId: existingRow?.plan_id ?? null,
      metaTelegramId: meta.telegram_id ?? null,
      metaTelegramIdAlt: meta.telegramId ?? null,
      metaPlanId,
      resolvedTelegramId,
      planId,
    })
    return { granted: false, reason: 'missing telegramId or planId' }
  }

  const durationDays = await getPlanDurationDays(planId)
  if (durationDays == null) {
    logGrantFailure(paymentId, 'plan not found or inactive', {
      planId,
      resolvedTelegramId,
    })
    return { granted: false, reason: 'plan not found' }
  }

  if (!existingRow) {
    await ensurePaymentRowForGrant(paymentId, resolvedTelegramId, planId)
  }

  const claimed = await claimPaymentForPremiumGrant(paymentId)
  if (!claimed) {
    const again = await findPaymentGrantRow(paymentId)
    if (again?.premium_granted_at) {
      console.log('[YooKassa] grantPremium: already processed (concurrent webhook)', {
        paymentId,
        premiumGrantedAt: again.premium_granted_at.toISOString(),
      })
      return { granted: false, alreadyDone: true, reason: 'already processed' }
    }
    logGrantFailure(paymentId, 'claim failed', {
      resolvedTelegramId,
      planId,
    })
    return { granted: false, reason: 'claim failed' }
  }

  const grantTelegramId =
    resolveTelegramIdForGrant({ rowTelegramId: claimed.telegram_id }) ?? resolvedTelegramId
  const grantPlanId =
    resolvePlanIdForGrant({ rowPlanId: claimed.plan_id }) ?? planId
  const grantDurationDays = (await getPlanDurationDays(grantPlanId)) ?? durationDays

  await ensureUser(grantTelegramId)

  try {
    const activeUntil = await extendPremiumActiveUntil(grantTelegramId, grantPlanId, grantDurationDays)
    await finalizePaymentGrant(paymentId)
    console.log('[YooKassa] grantPremium: success', {
      paymentId,
      telegramId: grantTelegramId,
      planId: grantPlanId,
      activeUntil: activeUntil.toISOString(),
    })
    return { granted: true, telegramId: grantTelegramId, planId: grantPlanId, activeUntil }
  } catch (e) {
    await releasePaymentGrantClaim(paymentId).catch((releaseErr) => {
      logPgError('[YooKassa] grantPremium: failed to release claim', releaseErr)
    })
    logPgError('[YooKassa] grantPremium: subscription upsert failed', e)
    throw e
  }
}

async function handleWebhook(req: Request, res: Response) {
  console.log('[YooKassa] webhook received', {
    event: req.body?.event,
    paymentId: req.body?.object?.id,
    status: req.body?.object?.status,
  })

  const secret = String(process.env.YOOKASSA_WEBHOOK_SECRET ?? '').trim()

  if (secret) {
    const authRaw = String(req.headers['authorization'] ?? '').trim()
    const auth =
      authRaw.toLowerCase().startsWith('bearer ') ? authRaw.slice(7).trim() : authRaw

    const authPreview =
      authRaw.length > 0
        ? `${authRaw.length} chars, starts: ${authRaw.slice(0, 6)}...`
        : 'absent'
    console.log('[YooKassa] webhook authorization', authPreview)

    if (auth !== secret) {
      console.warn('[YooKassa] webhook: invalid secret')
      res.status(200).json({ ok: true })
      return
    }
  } else {
    console.log('[YooKassa] webhook secret empty — skipping validation')
  }

  const body = req.body as {
    type?: string
    event?: string
    object?: {
      id?: string
      status?: string
      metadata?: { telegram_id?: string; plan_id?: string; telegramId?: string; planId?: string; userId?: string }
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
      const pid = typeof paymentId === 'string' ? paymentId.trim() : ''
      if (!pid) return

      // Не payment.succeeded — просто обновляем статус и выходим
      if (!isPaymentSucceeded) {
        if (newStatus) {
          await query(
            `UPDATE payments SET status = $1 WHERE provider_payment_charge_id = $2`,
            [newStatus, pid]
          ).catch(() => {})
        }
        return
      }

      // payment.succeeded — выдаём premium (grantPremiumByPaymentId помечает payments succeeded)
      const result = await grantPremiumByPaymentId(pid, { metadata })

      if (result.granted) {
        console.log(
          `[YooKassa] webhook: premium granted paymentId=${pid} telegramId=${result.telegramId} planId=${result.planId} until=${result.activeUntil.toISOString()}`
        )
        return
      }

      if (result.alreadyDone) {
        console.log('[YooKassa] webhook: already processed paymentId=', pid)
        return
      }

      console.error('[YooKassa] webhook: failed to grant premium', {
        paymentId: pid,
        reason: result.reason ?? 'unknown',
      })
    } catch (e) {
      logPgError('[YooKassa] webhook error', e)
    }
  }

  setImmediate(run)
  res.status(200).json({ ok: true })
}

async function handleConfirm(req: Request, res: Response) {
  const paymentIdRaw = req.body?.paymentId
  const telegramIdBodyRaw = req.body?.telegramId

  const paymentId = typeof paymentIdRaw === 'string' ? paymentIdRaw.trim() : ''
  const bodyTelegramId = normalizeTelegramId(telegramIdBodyRaw) ?? undefined

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
      metadata?: { telegram_id?: string; plan_id?: string; telegramId?: string; planId?: string; userId?: string }
    }

    const status = payment.status ?? null
    if (status !== 'succeeded') {
      res.status(200).json({ ok: false, status })
      return
    }

    const result = await grantPremiumByPaymentId(paymentId, {
      metadata: payment.metadata,
      bodyTelegramId,
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
    logPgError('[YooKassa] confirm error', e)
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
