import { query } from '../db.js'

const DAYS_6_MONTHS = 180

export function logPgError(prefix: string, e: unknown): void {
  if (e instanceof Error) {
    console.error(prefix, e.message)
    if (e.stack) console.error(e.stack)
    return
  }
  if (e && typeof e === 'object') {
    const err = e as { message?: string; code?: string; detail?: string; hint?: string }
    const parts = [err.message, err.code && `code=${err.code}`, err.detail && `detail=${err.detail}`, err.hint && `hint=${err.hint}`].filter(Boolean)
    console.error(prefix, parts.join(' | '))
    return
  }
  console.error(prefix, e)
}

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

export async function ensureUser(telegramId: string | number): Promise<void> {
  await query(
    'INSERT INTO users (telegram_id) VALUES ($1::bigint) ON CONFLICT (telegram_id) DO NOTHING',
    [String(telegramId)]
  )
}

export async function upsertSubscription(
  telegramId: string | number,
  planId: string,
  activeUntil: Date
): Promise<void> {
  await query(
    `INSERT INTO subscriptions (telegram_id, plan_id, active_until, created_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (telegram_id) DO UPDATE SET
       plan_id = EXCLUDED.plan_id,
       active_until = EXCLUDED.active_until`,
    [telegramId, planId, activeUntil]
  )
}

export async function getActiveSubscription(telegramId: string | number): Promise<Date | null> {
  const res = await query<{ active_until: Date }>(
    `SELECT active_until FROM subscriptions
     WHERE telegram_id = $1::bigint
     LIMIT 1`,
    [String(telegramId)]
  )
  const row = res.rows[0]
  return row ? new Date(row.active_until) : null
}

/**
 * Последняя по дате подписка пользователя.
 * premium в /api/me считают как active_until != null && active_until > now().
 */
export async function getLatestActiveUntil(telegramId: string | number): Promise<Date | null> {
  const res = await query<{ active_until: Date }>(
    `SELECT active_until
     FROM subscriptions
     WHERE telegram_id = $1::bigint
     ORDER BY active_until DESC
     LIMIT 1`,
    [String(telegramId)]
  )
  const row = res.rows[0]
  return row ? new Date(row.active_until) : null
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/**
 * Продлевает premium: новые дни добавляются к active_until, если подписка ещё активна.
 * Upsert по telegram_id (одна строка на пользователя).
 */
export async function extendPremiumActiveUntil(
  telegramId: string | number,
  planId: string,
  durationDays: number
): Promise<Date> {
  try {
    const res = await query<{ active_until: Date }>(
      `INSERT INTO subscriptions (telegram_id, plan_id, active_until, created_at)
       VALUES ($1::bigint, $2, now() + ($3::int || ' days')::interval, now())
       ON CONFLICT (telegram_id) DO UPDATE SET
         plan_id = EXCLUDED.plan_id,
         active_until = CASE
           WHEN subscriptions.active_until > now()
             THEN subscriptions.active_until + ($3::int || ' days')::interval
           ELSE now() + ($3::int || ' days')::interval
         END
       RETURNING active_until`,
      [String(telegramId), planId, durationDays]
    )
    const row = res.rows[0]
    if (!row) {
      throw new Error('Subscription upsert returned no rows')
    }
    return new Date(row.active_until)
  } catch (e) {
    logPgError('[subscriptions] extendPremiumActiveUntil failed', e)
    throw e
  }
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
