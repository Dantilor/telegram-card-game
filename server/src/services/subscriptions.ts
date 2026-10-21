import { query } from '../db.js'
import type { Queryable } from '../legal/types.js'
import { INSERT_STARS_PAYMENT_SQL } from '../payments/premiumGrantSql.js'

function database(db?: Queryable): Queryable {
  if (db) return db
  return {
    query: async <T>(sql: string, params?: unknown[]) => {
      const result = await query(sql, params)
      return { rows: result.rows as T[] }
    },
  }
}

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
 * Charge ids use the existing partial unique indexes. The amount is stored in total_amount.
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
  if (payment.currency == null || payment.currency.trim() === '') {
    throw new Error('Payment currency is required')
  }
  if (!Number.isInteger(payment.amount) || payment.amount < 0) {
    throw new Error('Payment amount is not a whole number')
  }

  if (tgCharge || provCharge) {
    const check = await query<{ n: number }>(
      `SELECT 1 FROM payments
        WHERE ($1::text IS NOT NULL AND telegram_payment_charge_id = $1)
           OR ($2::text IS NOT NULL AND provider_payment_charge_id = $2)
       LIMIT 1`,
      [tgCharge, provCharge]
    )
    if (check.rows.length > 0) return false
  } else {
    const check = await query<{ n: number }>(
      `SELECT 1 FROM payments
       WHERE telegram_id = $1 AND plan_id = $2
         AND total_amount = $3 AND currency = $4
         AND created_at > NOW() - INTERVAL '5 minutes'
       LIMIT 1`,
      [payment.telegramId, payment.planId, payment.amount, payment.currency]
    )
    if (check.rows.length > 0) return false
  }

  try {
    await query(
      `INSERT INTO payments (
         telegram_id, plan_id, currency, total_amount, status,
         telegram_payment_charge_id, provider_payment_charge_id
       ) VALUES ($1, $2, $3, $4, 'paid', $5, $6)`,
      [payment.telegramId, payment.planId, payment.currency, payment.amount, tgCharge, provCharge]
    )
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === '23505') {
      return false
    }
    throw e
  }
  return true
}

export async function ensureUser(telegramId: string | number, db?: Queryable): Promise<void> {
  await database(db).query(
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
  durationDays: number,
  db?: Queryable
): Promise<Date> {
  try {
    const res = await database(db).query<{ active_until: Date }>(
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
  if (payment.currency == null || payment.currency.trim() === '') {
    throw new Error('Stars payment currency is required')
  }
  if (!Number.isInteger(payment.amount) || payment.amount < 0) {
    throw new Error('Stars payment amount is not a whole number')
  }
  try {
    const res = await query<{ id: number }>(INSERT_STARS_PAYMENT_SQL, [
      payment.telegramId,
      payment.currency,
      payment.amount,
      payment.telegramPaymentChargeId,
      payment.providerPaymentChargeId,
    ])
    const row = res.rows[0]
    return row ? Number(row.id) : null
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === '23505') {
      return null
    }
    throw e
  }
}
