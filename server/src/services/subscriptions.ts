import { query } from '../db.js'

const DAYS_6_MONTHS = 180

/**
 * Try to save payment; returns false if duplicate (skip subscription update).
 * Uses INSERT; on UNIQUE conflict (provider, charge_id) returns false.
 */
export async function savePaymentIfNew(payment: {
  telegramId: number
  planId: string
  provider: 'stars' | 'rub'
  amount: number
  currency?: string | null
  telegramPaymentChargeId?: string | null
  providerPaymentChargeId?: string | null
}): Promise<boolean> {
  const tgCharge = payment.telegramPaymentChargeId ?? null
  const provCharge = payment.providerPaymentChargeId ?? null

  if (tgCharge || provCharge) {
    const check = await query<{ n: number }>(
      `SELECT 1 FROM payments WHERE provider = $1
        AND ((telegram_payment_charge_id = $2 AND $2 IS NOT NULL)
             OR (provider_payment_charge_id = $3 AND $3 IS NOT NULL))
       LIMIT 1`,
      [payment.provider, tgCharge, provCharge]
    )
    if (check.rows.length > 0) return false
  } else {
    const check = await query<{ n: number }>(
      `SELECT 1 FROM payments
       WHERE telegram_id = $1 AND provider = $2 AND plan_id = $3
         AND amount = $4 AND created_at > NOW() - INTERVAL '5 minutes'
       LIMIT 1`,
      [payment.telegramId, payment.provider, payment.planId, payment.amount]
    )
    if (check.rows.length > 0) return false
  }

  try {
    await query(
      `INSERT INTO payments (telegram_id, provider, plan_id, amount, currency,
       telegram_payment_charge_id, provider_payment_charge_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        payment.telegramId,
        payment.provider,
        payment.planId,
        payment.amount,
        payment.currency ?? null,
        tgCharge,
        provCharge,
      ]
    )
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === '23505') {
      return false
    }
    throw e
  }
  return true
}

export async function ensureUser(telegramId: number): Promise<void> {
  await query(
    'INSERT INTO users (telegram_id) VALUES ($1) ON CONFLICT (telegram_id) DO NOTHING',
    [telegramId]
  )
}

export async function upsertSubscription(
  telegramId: number,
  planId: string,
  activeUntil: Date
): Promise<void> {
  await query(
    `INSERT INTO subscriptions (telegram_id, plan_id, active_until)
     VALUES ($1, $2, $3)
     ON CONFLICT (telegram_id, plan_id)
     DO UPDATE SET active_until = EXCLUDED.active_until`,
    [telegramId, planId, activeUntil]
  )
}

export async function getActiveSubscription(
  telegramId: number,
  planId: string
): Promise<Date | null> {
  const res = await query<{ active_until: Date }>(
    `SELECT active_until FROM subscriptions
     WHERE telegram_id = $1 AND plan_id = $2
     LIMIT 1`,
    [telegramId, planId]
  )
  const row = res.rows[0]
  return row ? new Date(row.active_until) : null
}

/**
 * Последняя по дате подписка пользователя (без фильтра по plan_id).
 * premium в /api/me считают как active_until != null && active_until > now().
 */
export async function getLatestActiveUntil(telegramId: number): Promise<Date | null> {
  const res = await query<{ active_until: Date }>(
    `SELECT active_until
     FROM subscriptions
     WHERE telegram_id = $1
     ORDER BY active_until DESC
     LIMIT 1`,
    [telegramId]
  )
  const row = res.rows[0]
  return row ? new Date(row.active_until) : null
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/** Продлевает premium: новые дни добавляются к текущему active_until, если он ещё активен. */
export async function extendPremiumActiveUntil(
  telegramId: number,
  durationDays: number
): Promise<Date> {
  const now = new Date()
  const latest = await getLatestActiveUntil(telegramId)
  const base = latest && latest > now ? latest : now
  const activeUntil = addDays(base, durationDays)
  await upsertSubscription(telegramId, 'premium', activeUntil)
  return activeUntil
}

export const PREMIUM_ENTITLEMENT_PLAN_ID = 'premium'
export const LIFETIME_DURATION_DAYS = 36500

export const PREMIUM_DAYS = DAYS_6_MONTHS

/**
 * Insert Stars payment; returns inserted id if new, null if duplicate (ON CONFLICT).
 * Use for deduplication: only extend subscription when id is returned.
 */
export async function insertStarsPaymentIfNew(payment: {
  telegramId: number
  amount: number
  currency: string | null
  telegramPaymentChargeId: string
  providerPaymentChargeId: string | null
}): Promise<number | null> {
  const res = await query<{ id: number }>(
    `INSERT INTO payments (
       telegram_id,
       provider,
       plan_id,
       amount,
       currency,
       telegram_payment_charge_id,
       provider_payment_charge_id
     )
     VALUES ($1, 'stars', 'premium', $2, $3, $4, $5)
     ON CONFLICT (provider, telegram_payment_charge_id) DO NOTHING
     RETURNING id`,
    [
      payment.telegramId,
      payment.amount,
      payment.currency,
      payment.telegramPaymentChargeId,
      payment.providerPaymentChargeId,
    ]
  )
  const row = res.rows[0]
  return row ? row.id : null
}
