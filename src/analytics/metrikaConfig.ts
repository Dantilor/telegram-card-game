/** Yandex Metrika — WEB shell only. Counter created in the official Metrika cabinet. */

export const METRIKA_COUNTER_ID = 114652319
export const METRIKA_SCRIPT_URL = `https://mc.yandex.ru/metrika/tag.js?id=${METRIKA_COUNTER_ID}`

/** Official JS goals for Direct / VK Ads funnels. Create matching goals in the Metrika UI. */
export const METRIKA_GOALS = [
  'game_open',
  'game_start',
  'premium_view',
  'premium_checkout',
  'premium_payment_start',
  'premium_purchase',
  'account_login',
] as const

export type MetrikaGoal = (typeof METRIKA_GOALS)[number]

export function isMetrikaGoal(value: string): value is MetrikaGoal {
  return (METRIKA_GOALS as readonly string[]).includes(value)
}

/** Safe gameId / planId tokens only. */
export const METRIKA_SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/