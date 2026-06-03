export const LIFETIME_PLAN_ID = 'premium_lifetime'
export const LIFETIME_DURATION_DAYS = 36500

export const DEFAULT_PLAN_ID = 'premium_3m'

export type PlanOption = {
  id: string
  title: string
  priceRub: number
  durationDays: number
}

export function isLifetimePlan(planId: string, durationDays?: number): boolean {
  if (planId === LIFETIME_PLAN_ID) return true
  return typeof durationDays === 'number' && durationDays >= LIFETIME_DURATION_DAYS
}

export function formatPlanPeriod(durationDays: number): string {
  if (durationDays >= LIFETIME_DURATION_DAYS) return 'Навсегда'
  if (durationDays === 30) return '1 месяц'
  if (durationDays === 90) return '3 месяца'
  const months = Math.max(1, Math.round(durationDays / 30))
  return `${months} мес.`
}

export function formatPlanPriceLabel(plan: Pick<PlanOption, 'priceRub' | 'durationDays'>): string {
  return `${plan.priceRub} ₽ · ${formatPlanPeriod(plan.durationDays)}`
}

export function formatPlansFromPrice(plans: PlanOption[]): string {
  if (plans.length === 0) return 'Premium'
  const sorted = [...plans].sort((a, b) => a.priceRub - b.priceRub)
  const cheapest = sorted[0]
  return `от ${cheapest.priceRub} ₽`
}
