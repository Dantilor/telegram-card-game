export const LIFETIME_PLAN_ID = 'premium_lifetime'
export const LIFETIME_DURATION_DAYS = 36500

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
