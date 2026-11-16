import { Router, Request, Response } from 'express'
import { randomUUID } from 'node:crypto'
import { query } from '../db.js'
import { withTransaction } from '../legal/runtime.js'
import {
  ensureUser,
  extendPremiumActiveUntil,
  logPgError,
} from '../services/subscriptions.js'
import { getActivePlanById, getPlanDurationDays, planReceiptDescription } from '../services/plans.js'
import { resolvePlanIdForGrant, resolveTelegramIdForGrant } from '../utils/telegramId.js'
import { assertCheckout, assertWebCheckout, customerForNewYookassaReceipt } from '../legal/checkout.js'
import { LegalError, legalErrorBody } from '../legal/errors.js'
import {
  CLAIM_PREMIUM_GRANT_SQL,
  ENSURE_YOOKASSA_PAYMENT_SQL,
  FINALIZE_YOOKASSA_PAYMENT_SQL,
  INSERT_CHECKOUT_PAYMENT_SQL,
} from '../payments/premiumGrantSql.js'
import { resolveAuth, type AuthSource } from '../auth/resolveAuth.js'
import { webPublicOrigin } from '../auth/config.js'
import {
  fetchYookassaPayment,
  fetchYookassaRefund,
  parseYookassaAmountRub,
} from '../payments/yookassaClient.js'
import { yookassaMockEnabled } from '../payments/yookassaMock.js'
import { grantWebEntitlement, revokeWebPurchaseEntitlements } from '../auth/webAccounts.js'

const mockPayments = new Map<
  string,
  {
    status: string
    amount: { value: string; currency: string }
    metadata: Record<string, string>
  }
>()

async function verifyAuth(
  req: Request,
  res: Response
): Promise<{ telegramId?: number; webAccountId?: string; source: AuthSource } | null> {
  const auth = await resolveAuth(req, { requireCsrfForWeb: true })
  if (!auth) {
    res.status(401).json({ error: 'Unauthorized', code: 'unauthorized' })
    return null
  }
  if (!auth.telegramId && !auth.webAccountId) {
    res.status(401).json({ error: 'Unauthorized', code: 'unauthorized' })
    return null
  }
  return {
    telegramId: auth.telegramId,
    webAccountId: auth.webAccountId,
    source: auth.source,
  }
}

function resolvePaymentReturnUrl(source: AuthSource): string | null {
  if (source === 'web_session' || source === 'web_account') {
    const webReturn = (process.env.YOOKASSA_RETURN_URL_WEB ?? '').trim()
    if (webReturn) return webReturn
    const origin = webPublicOrigin()
    if (origin) return `${origin}/premium?payment=return`
  }
  const legacy = (process.env.YOOKASSA_RETURN_URL ?? '').trim()
  return legacy || null
}

async function grantWebAccountPremiumFromPayment(input: {
  paymentId: string
  webAccountId: string
  planId: string
  amountRub: number
  currency?: string
}): Promise<{ granted: boolean; alreadyDone?: boolean; reason?: string }> {
  if (input.currency && input.currency !== 'RUB') {
    return { granted: false, reason: 'currency_mismatch' }
  }

  const row = await query<{
    web_account_id: string
    plan_id: string
    amount_rub: number
    premium_granted_at: Date | null
  }>(
    `SELECT web_account_id::text AS web_account_id, plan_id, amount_rub, premium_granted_at
       FROM web_payments WHERE id = $1 LIMIT 1`,
    [input.paymentId]
  )
  const payment = row.rows[0]
  if (!payment) {
    return { granted: false, reason: 'web_payment_missing' }
  }
  if (payment.premium_granted_at) return { granted: false, alreadyDone: true }
  if (payment.web_account_id !== input.webAccountId) {
    return { granted: false, reason: 'web_account_mismatch' }
  }
  if (payment.plan_id !== input.planId) {
    return { granted: false, reason: 'plan_mismatch' }
  }
  if (Number(payment.amount_rub) !== Number(input.amountRub)) {
    return { granted: false, reason: 'amount_mismatch' }
  }

  const days = await getPlanDurationDays(input.planId)
  if (!days) return { granted: false, reason: 'plan_duration_missing' }

  return await withTransaction(async (tx) => {
    const claimed = await tx.query<{ id: string }>(
      `UPDATE web_payments
          SET status = 'succeeded',
              paid_at = COALESCE(paid_at, now()),
              premium_granted_at = now()
        WHERE id = $1
          AND premium_granted_at IS NULL
          AND web_account_id = $2::uuid
          AND plan_id = $3
          AND amount_rub = $4
        RETURNING id`,
      [input.paymentId, input.webAccountId, input.planId, input.amountRub]
    )
    if (!claimed.rows[0]) {
      const again = await tx.query<{ premium_granted_at: Date | null }>(
        `SELECT premium_granted_at FROM web_payments WHERE id = $1 LIMIT 1`,
        [input.paymentId]
      )
      if (again.rows[0]?.premium_granted_at) return { granted: false, alreadyDone: true }
      return { granted: false, reason: 'claim_failed' }
    }

    const existingUntil = await tx.query<{ active_until: Date }>(
      `SELECT active_until FROM web_entitlements
        WHERE web_account_id = $1::uuid AND active_until > now()
        ORDER BY active_until DESC LIMIT 1`,
      [input.webAccountId]
    )
    const base = existingUntil.rows[0]?.active_until
      ? new Date(existingUntil.rows[0].active_until)
      : new Date()
    const start = base.getTime() > Date.now() ? base : new Date()
    const activeUntil = new Date(start.getTime())
    activeUntil.setUTCDate(activeUntil.getUTCDate() + days)

    await grantWebEntitlement({
      webAccountId: input.webAccountId,
      planId: input.planId,
      activeUntil,
      source: 'web_purchase',
      paymentId: input.paymentId,
      db: tx,
    })
    return { granted: true }
  })
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
  const auth = await verifyAuth(req, res)
  if (auth == null) return
  const { telegramId, webAccountId, source } = auth

  const planId = req.body?.planId
  if (typeof planId !== 'string' || !planId.trim()) {
    res.status(400).json({ ok: false, error: 'planId required' })
    return
  }

  const shopId = process.env.YOOKASSA_SHOP_ID
  const secretKey = process.env.YOOKASSA_SECRET_KEY
  const returnUrl = resolvePaymentReturnUrl(source)
  if (!shopId || !secretKey || !returnUrl) {
    console.error('[YooKassa] Missing YOOKASSA_SHOP_ID, YOOKASSA_SECRET_KEY or return URL')
    res.status(503).json({ ok: false, error: 'Payment not configured' })
    return
  }

  try {
    const receiptCustomer = customerForNewYookassaReceipt(req.body?.email, req.body?.phone)
    const plan = await getActivePlanById(planId.trim())
    if (!plan) {
      res.status(400).json({ ok: false, error: 'Plan not found or inactive' })
      return
    }

    // Anonymous / email-bound WEB account checkout — never invents telegram_id.
    if (webAccountId) {
      let webCheckout: { evidenceId: number }
      try {
        webCheckout = await assertWebCheckout(
          {
            async query<T>(sql: string, params?: unknown[]) {
              const result = await query(sql, params)
              return { rows: result.rows as T[] }
            },
          },
          {
            webAccountId,
            plan: {
              planId: plan.plan_id,
              title: plan.title,
              priceRub: plan.price_rub,
              durationDays: plan.duration_days,
            },
            offerAcceptanceId: req.body?.offerAcceptanceId,
            email: receiptCustomer.email,
            phone: null,
          }
        )
      } catch (e) {
        if (e instanceof LegalError) {
          res.status(e.status).json(legalErrorBody(e))
          return
        }
        throw e
      }
      const idempotenceKey = randomUUID()
      const amount = `${plan.price_rub}.00`
      const metadata = {
        web_account_id: webAccountId,
        plan_id: plan.plan_id,
        planId: plan.plan_id,
        auth_source: source,
        offer_acceptance_id: String(webCheckout.evidenceId),
      }
      const description = `GameNight Host WEB: ${plan.title} (${plan.plan_id})`
      const receipt = buildReceipt({
        customerEmail: receiptCustomer.email,
        planTitle: plan.title,
        planId: plan.plan_id,
        durationDays: plan.duration_days,
        priceRub: plan.price_rub,
      })

      if (yookassaMockEnabled()) {
        const paymentId = `mock_web_${idempotenceKey.replace(/-/g, '').slice(0, 20)}`
        const confirmationUrl = `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}paymentId=${encodeURIComponent(paymentId)}&mock=1`
        mockPayments.set(paymentId, {
          status: 'pending',
          amount: { value: amount, currency: 'RUB' },
          metadata,
        })
        await query(
          `INSERT INTO web_payments (id, web_account_id, plan_id, amount_rub, status)
           VALUES ($1, $2::uuid, $3, $4, 'pending')
           ON CONFLICT (id) DO NOTHING`,
          [paymentId, webAccountId, plan.plan_id, plan.price_rub]
        )
        console.log('[YooKassa] MOCK WEB create paymentId=', paymentId)
        res.status(200).json({ confirmationUrl, paymentId, mock: true, webAccount: true })
        return
      }

      const yookassaRes = await fetch('https://api.yookassa.ru/v3/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64'),
          'Idempotence-Key': idempotenceKey,
        },
        body: JSON.stringify({
          amount: { value: amount, currency: 'RUB' },
          confirmation: { type: 'redirect' as const, return_url: returnUrl },
          capture: true,
          description,
          metadata,
          receipt,
        }),
      })
      if (!yookassaRes.ok) {
        const errText = await yookassaRes.text()
        console.error('[YooKassa] WEB API error:', yookassaRes.status, errText)
        res.status(502).json({ ok: false, error: 'Payment provider error' })
        return
      }
      const payment = (await yookassaRes.json()) as {
        id: string
        confirmation?: { confirmation_url?: string }
      }
      const confirmationUrl = payment.confirmation?.confirmation_url
      if (!payment.id || !confirmationUrl) {
        console.error('[YooKassa] WEB: invalid payment response')
        res.status(502).json({ ok: false, error: 'Invalid payment response' })
        return
      }
      await query(
        `INSERT INTO web_payments (id, web_account_id, plan_id, amount_rub, status)
         VALUES ($1, $2::uuid, $3, $4, 'pending')
         ON CONFLICT (id) DO NOTHING`,
        [payment.id, webAccountId, plan.plan_id, plan.price_rub]
      )
      res.status(200).json({ confirmationUrl, paymentId: payment.id, webAccount: true })
      return
    }

    if (!telegramId) {
      res.status(401).json({ ok: false, error: 'Unauthorized', code: 'unauthorized' })
      return
    }

    const checkout = await assertCheckout(
      {
        async query<T>(sql: string, params?: unknown[]) {
          const result = await query(sql, params)
          return { rows: result.rows as T[] }
        },
      },
      {
        telegramId,
        plan: {
          planId: plan.plan_id,
          title: plan.title,
          priceRub: plan.price_rub,
          durationDays: plan.duration_days,
        },
        offerAcceptanceId: req.body?.offerAcceptanceId,
        email: receiptCustomer.email,
        phone: null,
      }
    )

    await ensureUser(telegramId)

    const idempotenceKey = randomUUID()
    const amount = `${plan.price_rub}.00`

    const receipt = buildReceipt({
      customerEmail: receiptCustomer.email,
      planTitle: plan.title,
      planId: plan.plan_id,
      durationDays: plan.duration_days,
      priceRub: plan.price_rub,
    })

    const description = `GameNight Host: ${plan.title} (${plan.plan_id})`
    const metadata = {
      telegram_id: String(telegramId),
      userId: String(telegramId),
      plan_id: plan.plan_id,
      planId: plan.plan_id,
      auth_source: source,
    }

    if (yookassaMockEnabled()) {
      const paymentId = `mock_${idempotenceKey.replace(/-/g, '').slice(0, 24)}`
      const confirmationUrl = `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}paymentId=${encodeURIComponent(paymentId)}&mock=1`
      mockPayments.set(paymentId, {
        status: 'pending',
        amount: { value: amount, currency: 'RUB' },
        metadata,
      })
      await query(INSERT_CHECKOUT_PAYMENT_SQL, [
        telegramId,
        plan.plan_id,
        plan.price_rub,
        paymentId,
        checkout.evidenceId,
        checkout.contact.stored,
        checkout.contact.kind,
      ])
      console.log('[YooKassa] MOCK create paymentId=', paymentId)
      res.status(200).json({ confirmationUrl, paymentId, mock: true })
      return
    }

    const body = {
      amount: { value: amount, currency: 'RUB' },
      confirmation: { type: 'redirect' as const, return_url: returnUrl },
      capture: true,
      description,
      metadata,
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

    await query(INSERT_CHECKOUT_PAYMENT_SQL, [
      telegramId,
      plan.plan_id,
      plan.price_rub,
      payment.id,
      checkout.evidenceId,
      checkout.contact.stored,
      checkout.contact.kind,
    ])

    res.status(200).json({ confirmationUrl, paymentId: payment.id })
  } catch (e) {
    if (e instanceof LegalError) {
      res.status(e.status).json({ ok: false, ...legalErrorBody(e) })
      return
    }
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

async function ensurePaymentRowForGrant(
  paymentId: string,
  telegramId: string,
  planId: string,
  totalAmountRub: number
): Promise<void> {
  await query(ENSURE_YOOKASSA_PAYMENT_SQL, [telegramId, planId, totalAmountRub, paymentId])
}

/**
 * Общая логика выдачи premium по paymentId. Используется в webhook и confirm.
 * Идемпотентно: premium выдаётся один раз на provider_payment_charge_id (premium_granted_at).
 * Старые платежи со status=succeeded, но без premium_granted_at, можно обработать повторно.
 */
export async function grantPremiumByPaymentId(
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

  const catalogPlan = await getActivePlanById(planId)
  if (catalogPlan == null) {
    logGrantFailure(paymentId, 'plan not found or inactive', {
      planId,
      resolvedTelegramId,
    })
    return { granted: false, reason: 'plan not found' }
  }

  if (!existingRow) {
    await ensurePaymentRowForGrant(paymentId, resolvedTelegramId, planId, catalogPlan.price_rub)
  }

  try {
    return await withTransaction(async (tx) => {
      const claimedRes = await tx.query<PaymentGrantRow>(CLAIM_PREMIUM_GRANT_SQL, [paymentId])
      const claimed = claimedRes.rows[0]
      if (!claimed) {
        const again = await tx.query<PaymentGrantRow>(
          `SELECT id, status, telegram_id, plan_id, premium_granted_at
             FROM payments
            WHERE provider_payment_charge_id = $1
            LIMIT 1`,
          [paymentId]
        )
        if (again.rows[0]?.premium_granted_at) {
          console.log('[YooKassa] grantPremium: already processed (concurrent webhook)', {
            paymentId,
            premiumGrantedAt: new Date(again.rows[0].premium_granted_at).toISOString(),
          })
          return { granted: false, alreadyDone: true, reason: 'already processed' } as GrantPremiumResult
        }
        logGrantFailure(paymentId, 'claim failed', { resolvedTelegramId, planId })
        return { granted: false, reason: 'claim failed' } as GrantPremiumResult
      }

      const grantTelegramId =
        resolveTelegramIdForGrant({ rowTelegramId: claimed.telegram_id }) ?? resolvedTelegramId
      const grantPlanId = resolvePlanIdForGrant({ rowPlanId: claimed.plan_id }) ?? planId
      const grantDurationDays =
        grantPlanId === catalogPlan.plan_id
          ? catalogPlan.duration_days
          : await getPlanDurationDays(grantPlanId, tx)
      if (grantDurationDays == null) {
        throw new Error('plan not found')
      }

      await ensureUser(grantTelegramId, tx)
      const activeUntil = await extendPremiumActiveUntil(grantTelegramId, grantPlanId, grantDurationDays, tx)
      await tx.query(FINALIZE_YOOKASSA_PAYMENT_SQL, [paymentId])
      console.log('[YooKassa] grantPremium: success', {
        paymentId,
        telegramId: grantTelegramId,
        planId: grantPlanId,
        activeUntil: activeUntil.toISOString(),
      })
      return {
        granted: true,
        telegramId: grantTelegramId,
        planId: grantPlanId,
        activeUntil,
      } as GrantPremiumResult
    })
  } catch (e) {
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
  const requireSecret =
    process.env.YOOKASSA_WEBHOOK_REQUIRE_SECRET === '1' ||
    process.env.YOOKASSA_WEBHOOK_REQUIRE_SECRET === 'true'

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
  } else if (requireSecret) {
    console.warn('[YooKassa] webhook: secret required but empty — rejecting grant path')
    res.status(200).json({ ok: true })
    return
  } else {
    // Secret optional: premium is still only granted after authenticated API verification below.
    console.log('[YooKassa] webhook secret empty — relying on authenticated payment lookup')
  }

  const body = req.body as {
    type?: string
    event?: string
    object?: {
      id?: string
      payment_id?: string
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
  const statusMap: Record<string, string> = {
    'payment.succeeded': 'succeeded',
    'payment.canceled': 'canceled',
    'payment.waiting_for_capture': 'waiting_for_capture',
    'payment.failed': 'failed',
  }
  const newStatus = eventType ? statusMap[eventType] : obj.status ? statusMap[`payment.${obj.status}`] ?? obj.status : null
  const claimsSucceeded = eventType === 'payment.succeeded' || (!eventType && obj.status === 'succeeded')

  const run = async () => {
    try {
      const pid = typeof paymentId === 'string' ? paymentId.trim() : ''
      if (!pid) return

      if (!claimsSucceeded) {
        // Telegram payments: status-only update (no WEB revoke from unverified body).
        if (newStatus && eventType !== 'refund.succeeded') {
          await query(
            `UPDATE payments SET status = $1 WHERE provider_payment_charge_id = $2`,
            [newStatus, pid]
          ).catch(() => {})
        }

        // WEB cancel/failed: verify payment status via API before touching entitlements.
        if (newStatus === 'canceled' || newStatus === 'failed') {
          let verifiedCancel: { status?: string } | null = null
          if (yookassaMockEnabled() && pid.startsWith('mock_')) {
            verifiedCancel = mockPayments.get(pid) ?? { status: newStatus }
          } else {
            verifiedCancel = await fetchYookassaPayment(pid)
          }
          const apiStatus = verifiedCancel?.status ?? null
          if (apiStatus !== 'canceled' && apiStatus !== 'failed') {
            console.warn('[YooKassa] webhook: skip WEB cancel revoke — API status mismatch', {
              paymentId: pid,
              claimed: newStatus,
              apiStatus,
            })
          } else {
            await query(`UPDATE web_payments SET status = $1 WHERE id = $2`, [apiStatus, pid])
            const revoked = await revokeWebPurchaseEntitlements({ paymentId: pid })
            if (revoked > 0) {
              console.log(
                `[YooKassa] webhook: revoked ${revoked} WEB purchase entitlement(s) for ${pid} (${apiStatus})`
              )
            }
          }
        }

        // Refund: verify refund object via API; full vs partial rules.
        if (eventType === 'refund.succeeded') {
          const refundId = pid
          let verifiedRefund: {
            id: string
            status: string
            payment_id: string
            amount?: { value?: string; currency?: string }
          } | null = null

          if (yookassaMockEnabled() && refundId.startsWith('mock_refund_')) {
            const paymentIdFromBody =
              typeof obj.payment_id === 'string' ? obj.payment_id.trim() : ''
            verifiedRefund = {
              id: refundId,
              status: 'succeeded',
              payment_id: paymentIdFromBody,
              amount: (obj as { amount?: { value?: string; currency?: string } }).amount,
            }
          } else {
            verifiedRefund = await fetchYookassaRefund(refundId)
          }

          if (!verifiedRefund || verifiedRefund.status !== 'succeeded') {
            console.warn('[YooKassa] webhook: refund not confirmed by API', {
              refundId,
              apiStatus: verifiedRefund?.status ?? null,
            })
            return
          }

          const originalPaymentId = verifiedRefund.payment_id.trim()
          if (!originalPaymentId) {
            console.error('[YooKassa] webhook: refund missing payment_id', { refundId })
            return
          }

          const refundRub = parseYookassaAmountRub(verifiedRefund.amount?.value)
          const currency = verifiedRefund.amount?.currency ?? 'RUB'
          if (currency !== 'RUB' || refundRub == null || refundRub <= 0) {
            console.error('[YooKassa] webhook: refund amount/currency invalid', {
              refundId,
              refundRub,
              currency,
            })
            return
          }

          await withTransaction(async (tx) => {
            const webPay = await tx.query<{
              id: string
              amount_rub: number
              status: string
            }>(
              `SELECT id, amount_rub, status FROM web_payments WHERE id = $1 LIMIT 1 FOR UPDATE`,
              [originalPaymentId]
            )
            const row = webPay.rows[0]
            if (!row) {
              // Not a WEB payment — leave Telegram flow untouched.
              return
            }
            if (row.status === 'refunded') {
              console.log('[YooKassa] webhook: WEB refund already processed', originalPaymentId)
              return
            }

            const paidRub = Number(row.amount_rub)
            if (!Number.isFinite(paidRub) || paidRub <= 0) {
              throw new Error(`web_payments amount invalid for ${originalPaymentId}`)
            }

            if (refundRub + 0.001 < paidRub) {
              // Partial refund: record status, do NOT revoke full Premium rights.
              await tx.query(`UPDATE web_payments SET status = 'partially_refunded' WHERE id = $1`, [
                originalPaymentId,
              ])
              console.log(
                `[YooKassa] webhook: partial WEB refund recorded paymentId=${originalPaymentId} refundRub=${refundRub} paidRub=${paidRub} (entitlement kept)`
              )
              return
            }

            await tx.query(`UPDATE web_payments SET status = 'refunded' WHERE id = $1`, [originalPaymentId])
            await revokeWebPurchaseEntitlements({ paymentId: originalPaymentId, db: tx })
            console.log(
              `[YooKassa] webhook: full WEB refund revoked entitlements paymentId=${originalPaymentId} refundId=${refundId}`
            )
          })
        }
        return
      }

      // Never grant from unverified webhook body alone — confirm via YooKassa API
      // (or local mock store when YOOKASSA_MOCK is enabled).
      let verified: {
        status?: string
        amount?: { value?: string; currency?: string }
        metadata?: Record<string, string>
      } | null = null

      if (yookassaMockEnabled() && pid.startsWith('mock_')) {
        const mock = mockPayments.get(pid)
        if (mock) {
          mock.status = 'succeeded'
          mockPayments.set(pid, mock)
          verified = mock
        } else if (claimsSucceeded && obj.status === 'succeeded') {
          // Allow E2E to POST succeeded mock without prior create map entry if DB row exists.
          verified = {
            status: 'succeeded',
            amount: { value: '259.00', currency: 'RUB' },
            metadata: (obj.metadata as Record<string, string> | undefined) ?? {},
          }
        }
      } else {
        verified = await fetchYookassaPayment(pid)
      }

      if (!verified || verified.status !== 'succeeded') {
        console.warn('[YooKassa] webhook: API did not confirm succeeded', {
          paymentId: pid,
          apiStatus: verified?.status ?? null,
        })
        return
      }

      if (verified.amount?.currency && verified.amount.currency !== 'RUB') {
        console.error('[YooKassa] webhook: unexpected currency', verified.amount.currency)
        return
      }

      const existing = await findPaymentGrantRow(pid)
      const apiAmount = parseYookassaAmountRub(verified.amount?.value)
      if (existing && apiAmount != null) {
        const dbAmountRes = await query<{ total_amount: number | string | null }>(
          `SELECT total_amount FROM payments WHERE provider_payment_charge_id = $1 LIMIT 1`,
          [pid]
        )
        const dbAmount = dbAmountRes.rows[0]?.total_amount
        const dbRub =
          typeof dbAmount === 'number'
            ? dbAmount
            : typeof dbAmount === 'string'
              ? Number.parseInt(dbAmount, 10)
              : null
        if (dbRub != null && Number.isFinite(dbRub) && dbRub !== apiAmount) {
          console.error('[YooKassa] webhook: amount mismatch', {
            paymentId: pid,
            dbRub,
            apiAmount,
          })
          return
        }
      }

      const meta = verified.metadata ?? {}
      const webAccountId = (meta.web_account_id || '').trim()
      const planId = (meta.plan_id || meta.planId || '').trim()
      if (webAccountId && planId) {
        const amountRub = parseYookassaAmountRub(verified.amount?.value)
        if (amountRub == null || amountRub <= 0) {
          console.error('[YooKassa] webhook: WEB amount missing', { paymentId: pid })
          return
        }
        const catalogPlan = await getActivePlanById(planId)
        if (!catalogPlan || catalogPlan.price_rub !== amountRub) {
          console.error('[YooKassa] webhook: WEB plan/amount mismatch vs catalog', {
            paymentId: pid,
            planId,
            amountRub,
            catalog: catalogPlan?.price_rub,
          })
          return
        }
        const webGrant = await grantWebAccountPremiumFromPayment({
          paymentId: pid,
          webAccountId,
          planId,
          amountRub,
          currency: verified.amount?.currency || 'RUB',
        })
        if (webGrant.granted) {
          console.log(
            `[YooKassa] webhook: WEB premium granted paymentId=${pid} webAccountId=${webAccountId} planId=${planId}`
          )
          return
        }
        if (webGrant.alreadyDone) {
          console.log('[YooKassa] webhook: WEB already processed paymentId=', pid)
          return
        }
        console.error('[YooKassa] webhook: failed to grant WEB premium', {
          paymentId: pid,
          reason: webGrant.reason ?? 'unknown',
        })
        return
      }

      const result = await grantPremiumByPaymentId(pid, {
        metadata: verified.metadata,
      })

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
      throw e
    }
  }

  // Await processing so provider retries on failure (do not ACK then drop work).
  try {
    await run()
    res.status(200).json({ ok: true })
  } catch (e) {
    logPgError('[YooKassa] webhook failed — returning 500 for retry', e)
    res.status(500).json({ ok: false, error: 'webhook_processing_failed' })
  }
}

async function handleConfirm(req: Request, res: Response) {
  // Confirm is a status refresh after return_url — still requires dual-auth.
  // return_url alone is never treated as success; provider API must confirm.
  const auth = await verifyAuth(req, res)
  if (auth == null) return

  const paymentIdRaw = req.body?.paymentId
  const paymentId = typeof paymentIdRaw === 'string' ? paymentIdRaw.trim() : ''

  if (!paymentId) {
    res.status(400).json({ ok: false, error: 'paymentId required' })
    return
  }

  try {
    // return_url confirm must not invent success: mock stays pending until webhook (or API).
    let payment: {
      status?: string
      amount?: { value?: string; currency?: string }
      metadata?: Record<string, string>
    } | null = null
    if (yookassaMockEnabled() && paymentId.startsWith('mock_')) {
      payment = mockPayments.get(paymentId) ?? { status: 'pending', metadata: {} }
    } else {
      payment = await fetchYookassaPayment(paymentId)
    }
    if (!payment) {
      res.status(502).json({ ok: false, error: 'Payment provider error' })
      return
    }

    const status = payment.status ?? null
    if (status !== 'succeeded') {
      res.status(200).json({ ok: false, status, paymentId })
      return
    }

    // ——— WEB account confirm ———
    if (auth.webAccountId) {
      const webRow = await query<{
        web_account_id: string
        plan_id: string
        amount_rub: number
        premium_granted_at: Date | null
        status: string
      }>(
        `SELECT web_account_id::text AS web_account_id, plan_id, amount_rub, premium_granted_at, status
           FROM web_payments WHERE id = $1 LIMIT 1`,
        [paymentId]
      )
      const row = webRow.rows[0]
      if (!row) {
        res.status(404).json({ ok: false, error: 'web_payment_not_found', paymentId })
        return
      }
      if (row.web_account_id !== auth.webAccountId) {
        res.status(403).json({ ok: false, error: 'payment_owner_mismatch' })
        return
      }

      const meta = payment.metadata ?? {}
      const metaAccount = (meta.web_account_id || '').trim()
      if (metaAccount && metaAccount !== auth.webAccountId) {
        res.status(403).json({ ok: false, error: 'payment_owner_mismatch' })
        return
      }

      const apiAmount = parseYookassaAmountRub(payment.amount?.value)
      if (payment.amount?.currency && payment.amount.currency !== 'RUB') {
        res.status(400).json({ ok: false, error: 'currency_mismatch' })
        return
      }
      if (apiAmount == null || apiAmount !== Number(row.amount_rub)) {
        res.status(400).json({ ok: false, error: 'amount_mismatch' })
        return
      }

      const planId = (meta.plan_id || meta.planId || row.plan_id || '').trim()
      if (!planId || planId !== row.plan_id) {
        res.status(400).json({ ok: false, error: 'plan_mismatch' })
        return
      }
      const catalogPlan = await getActivePlanById(planId)
      if (!catalogPlan || catalogPlan.price_rub !== Number(row.amount_rub)) {
        res.status(400).json({ ok: false, error: 'plan_catalog_mismatch' })
        return
      }

      const grant = await grantWebAccountPremiumFromPayment({
        paymentId,
        webAccountId: auth.webAccountId,
        planId,
        amountRub: Number(row.amount_rub),
        currency: 'RUB',
      })

      if (grant.granted || grant.alreadyDone) {
        const premium = await query<{ active_until: Date | null }>(
          `SELECT active_until FROM web_entitlements
            WHERE web_account_id = $1::uuid AND active_until > now()
            ORDER BY active_until DESC LIMIT 1`,
          [auth.webAccountId]
        )
        console.log(
          `[YooKassa] confirm WEB paymentId=${paymentId} webAccountId=${auth.webAccountId} granted=${Boolean(grant.granted)} alreadyDone=${Boolean(grant.alreadyDone)}`
        )
        res.status(200).json({
          ok: true,
          status,
          paymentId,
          webAccountId: auth.webAccountId,
          planId,
          alreadyDone: Boolean(grant.alreadyDone),
          activeUntil: premium.rows[0]?.active_until
            ? new Date(premium.rows[0].active_until).toISOString()
            : null,
        })
        return
      }

      res.status(400).json({
        ok: false,
        error: grant.reason ?? 'web_grant_failed',
        paymentId,
        status,
      })
      return
    }

    // ——— Telegram confirm (unchanged ownership rules) ———
    if (!auth.telegramId) {
      res.status(401).json({ ok: false, error: 'Unauthorized', code: 'unauthorized' })
      return
    }

    const existing = await findPaymentGrantRow(paymentId)
    const rowTelegram =
      existing?.telegram_id != null ? String(existing.telegram_id) : null
    if (rowTelegram && rowTelegram !== String(auth.telegramId)) {
      res.status(403).json({ ok: false, error: 'payment_owner_mismatch' })
      return
    }

    const result = await grantPremiumByPaymentId(paymentId, {
      metadata: payment.metadata,
    })

    if (result.granted) {
      if (String(result.telegramId) !== String(auth.telegramId)) {
        res.status(403).json({ ok: false, error: 'payment_owner_mismatch' })
        return
      }
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
