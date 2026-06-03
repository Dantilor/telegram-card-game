import { query } from '../db.js'

export const LIFETIME_PLAN_ID = 'premium_lifetime'
export const LIFETIME_DURATION_DAYS = 36500

export type PlanRow = {
  plan_id: string
  title: string
  price_rub: number
  duration_days: number
}

export function isLifetimePlan(planId: string, durationDays?: number): boolean {
  if (planId === LIFETIME_PLAN_ID) return true
  return typeof durationDays === 'number' && durationDays >= LIFETIME_DURATION_DAYS
}

export function planReceiptDescription(durationDays: number): string {
  if (durationDays >= LIFETIME_DURATION_DAYS) {
    return 'Подписка GameNight Host Premium (навсегда)'
  }
  const months = Math.max(1, Math.round(durationDays / 30))
  return `Подписка GameNight Host Premium (${months} мес.)`
}

export async function getActivePlanById(planId: string): Promise<PlanRow | null> {
  const res = await query<PlanRow>(
    `SELECT plan_id, title, price_rub, duration_days
     FROM plans
     WHERE plan_id = $1 AND is_active = true
     LIMIT 1`,
    [planId]
  )
  return res.rows[0] ?? null
}

export async function getPlanDurationDays(planId: string): Promise<number | null> {
  const plan = await getActivePlanById(planId)
  return plan?.duration_days ?? null
}
