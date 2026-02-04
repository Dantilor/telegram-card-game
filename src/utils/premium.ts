/** Включить/выключить блокировки по подписке. false = всё доступно */
export const PREMIUM_ENABLED = true

export function isPremiumUnlocked(): boolean {
  return !PREMIUM_ENABLED
}
