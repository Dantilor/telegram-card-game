/**
 * Premium storage: memoryStore (fast) + PostgreSQL (persistent).
 * Bot saves to both; /api/me reads from memory, falls back to DB if empty.
 */

import { getUser, setPremium, isPremium } from './memoryStore.js'

function logDbError(prefix: string, e: unknown): void {
  console.warn(prefix, e)
  if (e && typeof e === 'object' && 'code' in e) {
    const err = e as { code?: string; detail?: string; hint?: string; where?: string }
    const parts: string[] = []
    if (err.code != null) parts.push(`code=${err.code}`)
    if (err.detail != null) parts.push(`detail=${err.detail}`)
    if (err.hint != null) parts.push(`hint=${err.hint}`)
    if (err.where != null) parts.push(`where=${err.where}`)
    if (parts.length > 0) console.warn(prefix, 'pg:', parts.join(', '))
  }
}

const DEFAULT_PLAN_ID = 'premium'

export type PaymentRecord = {
  telegramId: number
  planId: string
  currency: string
  totalAmount: number
  providerPaymentChargeId?: string | null
  telegramPaymentChargeId?: string | null
  invoicePayload?: string | null
  status?: string
}

function addCalendarMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

async function getQuery() {
  const { query } = await import('./db.js')
  return query
}

export async function getActiveUntilDb(telegramId: number): Promise<Date | null> {
  if (!process.env.DATABASE_URL) return null
  try {
    const query = await getQuery()
    const res = await query<{ active_until: Date }>(
      `SELECT active_until FROM subscriptions WHERE telegram_id = $1 LIMIT 1`,
      [telegramId]
    )
    const row = res.rows[0]
    return row ? new Date(row.active_until) : null
  } catch (e) {
    logDbError('[premiumStore] getActiveUntilDb failed:', e)
    return null
  }
}

export async function savePaymentDb(payment: PaymentRecord): Promise<boolean> {
  if (!process.env.DATABASE_URL) return true
  try {
    const query = await getQuery()
    if (payment.providerPaymentChargeId || payment.telegramPaymentChargeId) {
      const parts: string[] = []
      const params: unknown[] = []
      let i = 1
      if (payment.providerPaymentChargeId) {
        parts.push(`provider_payment_charge_id = $${i++}`)
        params.push(payment.providerPaymentChargeId)
      }
      if (payment.telegramPaymentChargeId) {
        parts.push(`telegram_payment_charge_id = $${i++}`)
        params.push(payment.telegramPaymentChargeId)
      }
      const check = await query<{ n: number }>(
        `SELECT 1 FROM payments WHERE ${parts.join(' OR ')} LIMIT 1`,
        params
      )
      if (check.rows.length > 0) return false
    } else {
      const check = await query<{ count: string }>(
        `SELECT 1 FROM payments WHERE telegram_id = $1 AND invoice_payload = $2
         AND total_amount = $3 AND created_at > NOW() - INTERVAL '5 minutes'
         LIMIT 1`,
        [payment.telegramId, payment.invoicePayload ?? '', payment.totalAmount]
      )
      if (check.rows.length > 0) return false
    }

    await query(
      `INSERT INTO users (telegram_id) VALUES ($1) ON CONFLICT (telegram_id) DO NOTHING`,
      [payment.telegramId]
    )
    await query(
      `INSERT INTO payments (telegram_id, plan_id, currency, total_amount,
       provider_payment_charge_id, telegram_payment_charge_id, invoice_payload, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        payment.telegramId,
        payment.planId,
        payment.currency,
        payment.totalAmount,
        payment.providerPaymentChargeId ?? null,
        payment.telegramPaymentChargeId ?? null,
        payment.invoicePayload ?? null,
        payment.status ?? 'paid',
      ]
    )
    return true
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && e.code === '23505') {
      return false
    }
    logDbError('[premiumStore] savePaymentDb failed:', e)
    return true
  }
}

function getDurationMonths(planId: string): number {
  if (planId === 'year' || planId === 'premium_year' || planId === 'premium_12m') return 12
  if (planId === 'premium_6m_259' || planId === 'month' || planId === 'premium_month') return 6
  return 6
}

export async function setPremiumWithPersistence(
  telegramId: number,
  planId: string,
  payment: PaymentRecord
): Promise<boolean> {
  const saved = await savePaymentDb(payment)
  if (!saved) return false

  const durationMonths = getDurationMonths(planId)
  const now = new Date()

  const dbUntil = await getActiveUntilDb(telegramId)
  const mem = getUser(telegramId)
  const memUntil = mem?.premiumUntil ? new Date(mem.premiumUntil) : null
  const currentUntil = dbUntil ?? memUntil
  const base = currentUntil && currentUntil > now ? currentUntil : now

  const newUntil = addCalendarMonths(base, durationMonths)
  const newUntilTs = newUntil.getTime()

  setPremium(telegramId, newUntilTs)

  if (process.env.DATABASE_URL) {
    try {
      const query = await getQuery()
      await query(
        `INSERT INTO users (telegram_id) VALUES ($1) ON CONFLICT (telegram_id) DO NOTHING`,
        [telegramId]
      )
      await query(
        `INSERT INTO subscriptions (telegram_id, plan_id, active_until, created_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (telegram_id) DO UPDATE SET
           plan_id = EXCLUDED.plan_id,
           active_until = EXCLUDED.active_until`,
        [telegramId, DEFAULT_PLAN_ID, newUntil]
      )
    } catch (e) {
      logDbError('[premiumStore] subscription upsert failed:', e)
    }
  }

  return true
}

export function getUserPremium(telegramId: number): { premiumUntil: number } | null {
  const mem = getUser(telegramId)
  if (mem?.premiumUntil != null) return { premiumUntil: mem.premiumUntil }
  return null
}

async function getPremiumFromDb(telegramId: number): Promise<{ premiumUntil: number; planId: string } | null> {
  if (!process.env.DATABASE_URL) return null
  try {
    const query = await getQuery()
    const res = await query<{ active_until: Date; plan_id: string }>(
      `SELECT active_until, plan_id FROM subscriptions WHERE telegram_id = $1 LIMIT 1`,
      [telegramId]
    )
    const row = res.rows[0]
    if (!row) return null
    return {
      premiumUntil: new Date(row.active_until).getTime(),
      planId: row.plan_id,
    }
  } catch (e) {
    logDbError('[premiumStore] getPremiumFromDb failed:', e)
    return null
  }
}

export async function getUserPremiumWithDb(telegramId: number): Promise<{
  premium: boolean
  premiumUntil: string | null
  planId: string | null
}> {
  const mem = getUser(telegramId)
  if (mem?.premiumUntil) {
    const premium = mem.premiumUntil > Date.now()
    return {
      premium,
      premiumUntil: new Date(mem.premiumUntil).toISOString(),
      planId: DEFAULT_PLAN_ID,
    }
  }
  const db = await getPremiumFromDb(telegramId)
  if (db) {
    setPremium(telegramId, db.premiumUntil)
    const premium = db.premiumUntil > Date.now()
    return {
      premium,
      premiumUntil: new Date(db.premiumUntil).toISOString(),
      planId: db.planId,
    }
  }
  return { premium: false, premiumUntil: null, planId: null }
}

export { isPremium }

/** Admin: grant premium without touching payments. Extend from max(now, active_until). */
export async function adminGrantPremium(
  telegramId: number,
  opts: { months?: number; days?: number } = {}
): Promise<{ premiumUntil: number }> {
  const months = opts.months ?? 6
  const days = opts.days ?? 0

  const now = new Date()
  const dbUntil = await getActiveUntilDb(telegramId)
  const mem = getUser(telegramId)
  const memUntil = mem?.premiumUntil ? new Date(mem.premiumUntil) : null
  const currentUntil = dbUntil ?? memUntil
  const base = currentUntil && currentUntil > now ? currentUntil : now

  const newUntil = new Date(base)
  newUntil.setMonth(newUntil.getMonth() + months)
  newUntil.setDate(newUntil.getDate() + days)
  const newUntilTs = newUntil.getTime()

  setPremium(telegramId, newUntilTs)

  if (process.env.DATABASE_URL) {
    try {
      const query = await getQuery()
      await query(
        `INSERT INTO users (telegram_id) VALUES ($1) ON CONFLICT (telegram_id) DO NOTHING`,
        [telegramId]
      )
      await query(
        `INSERT INTO subscriptions (telegram_id, plan_id, active_until, created_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (telegram_id) DO UPDATE SET
           plan_id = EXCLUDED.plan_id,
           active_until = EXCLUDED.active_until`,
        [telegramId, DEFAULT_PLAN_ID, newUntil]
      )
    } catch (e) {
      logDbError('[premiumStore] adminGrant failed:', e)
      throw e
    }
  }

  return { premiumUntil: newUntilTs }
}

/** Admin: revoke premium — set active_until = now. */
export async function adminRevokePremium(telegramId: number): Promise<void> {
  const now = new Date()
  const nowTs = now.getTime()

  setPremium(telegramId, nowTs - 1)

  if (process.env.DATABASE_URL) {
    try {
      const query = await getQuery()
      await query(
        `INSERT INTO users (telegram_id) VALUES ($1) ON CONFLICT (telegram_id) DO NOTHING`,
        [telegramId]
      )
      await query(
        `INSERT INTO subscriptions (telegram_id, plan_id, active_until, created_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (telegram_id) DO UPDATE SET
           plan_id = EXCLUDED.plan_id,
           active_until = EXCLUDED.active_until`,
        [telegramId, DEFAULT_PLAN_ID, now]
      )
    } catch (e) {
      logDbError('[premiumStore] adminRevoke failed:', e)
      throw e
    }
  }
}

export type PaymentRow = {
  id: number
  telegram_id: number
  plan_id: string
  currency: string
  total_amount: number
  status: string
  created_at: Date
}

/** Admin: get last N payments for a user. */
export async function getLastPaymentsDb(telegramId: number, limit: number): Promise<PaymentRow[]> {
  if (!process.env.DATABASE_URL) return []
  try {
    const query = await getQuery()
    const res = await query<PaymentRow>(
      `SELECT id, telegram_id, plan_id, currency, total_amount, status, created_at
       FROM payments WHERE telegram_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [telegramId, limit]
    )
    return res.rows
  } catch (e) {
    logDbError('[premiumStore] getLastPaymentsDb failed:', e)
    return []
  }
}
