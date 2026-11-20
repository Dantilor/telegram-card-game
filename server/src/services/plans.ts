import { query } from '../db.js'
import type { Queryable } from '../legal/types.js'

function database(db?: Queryable): Queryable {
  if (db) return db
  return {
    query: async <T>(sql: string, params?: unknown[]) => {
      const result = await query(sql, params)
      return { rows: result.rows as T[] }
    },
  }
}

export const LIFETIME_PLAN_ID = 'premium_lifetime'
export const LIFETIME_DURATION_DAYS = 36500

export type PlanAudience = 'all' | 'telegram' | 'web'

export type PlanRow = {
  plan_id: string
  title: string
  price_rub: number
  duration_days: number
  audience: PlanAudience
}

export function planAllowedForChannel(
  plan: Pick<PlanRow, 'audience'>,
  channel: 'telegram' | 'web'
): boolean {
  if (plan.audience === 'all') return true
  return plan.audience === channel
}

export function isLifetimePlan(planId: string, durationDays?: number): boolean {
  if (planId === LIFETIME_PLAN_ID || planId === 'premium_web_lifetime') return true
  return typeof durationDays === 'number' && durationDays >= LIFETIME_DURATION_DAYS
}

export function planReceiptDescription(durationDays: number): string {
  if (durationDays >= LIFETIME_DURATION_DAYS) {
    return 'Подписка GameNight Host Premium (навсегда)'
  }
  const months = Math.max(1, Math.round(durationDays / 30))
  return `Подписка GameNight Host Premium (${months} мес.)`
}

function isMissingAudienceColumn(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return /column ["']?audience["']? does not exist/i.test(msg)
}

export async function getActivePlanById(planId: string, db?: Queryable): Promise<PlanRow | null> {
  const q = database(db)
  try {
    const res = await q.query<PlanRow>(
      `SELECT COALESCE(plan_id, id) AS plan_id, title, price_rub, duration_days,
              COALESCE(audience, 'all') AS audience
       FROM plans
       WHERE (plan_id = $1 OR id = $1) AND is_active = true
       LIMIT 1`,
      [planId]
    )
    return res.rows[0] ?? null
  } catch (error) {
    if (!isMissingAudienceColumn(error)) throw error
    const res = await q.query<Omit<PlanRow, 'audience'> & { audience?: PlanAudience }>(
      `SELECT COALESCE(plan_id, id) AS plan_id, title, price_rub, duration_days
       FROM plans
       WHERE (plan_id = $1 OR id = $1) AND is_active = true
       LIMIT 1`,
      [planId]
    )
    const row = res.rows[0]
    return row ? { ...row, audience: 'all' } : null
  }
}

export async function getPlanDurationDays(planId: string, db?: Queryable): Promise<number | null> {
  const plan = await getActivePlanById(planId, db)
  return plan?.duration_days ?? null
}
