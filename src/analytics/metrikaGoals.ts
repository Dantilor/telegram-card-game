/**
 * Typed Metrika goals + purchase pending helpers.
 * Never pass email, telegram id, tokens, payment ids, or form contents.
 *
 * premium_purchase is intentionally disabled until the API can prove a NEW grant
 * (see PREMIUM_PURCHASE_METRIKA_ENABLED and docs/legal-drafts/...).
 */

import { isMetrikaGoal, METRIKA_SAFE_ID, type MetrikaGoal } from './metrikaConfig'
import { isMetrikaConsentGranted } from './metrikaConsent'
import { enableYandexMetrika, reachYandexGoal } from './yandexMetrika'

const PAY_PENDING_KEY = 'gnh_metrika_pay_pending'
const PAY_PENDING_MAX_MS = 6 * 60 * 60 * 1000

/**
 * Client today only sees boolean Premium + activeUntil.
 * That cannot distinguish: already-premium before checkout, restore, failed payment
 * with leftover pending, or a genuine new webhook grant.
 * Re-enable only after a client-safe "new entitlement bump" (no paymentId/email).
 */
export const PREMIUM_PURCHASE_METRIKA_ENABLED = false

const sentGoals = new Set<string>()

function safeParams(input?: Record<string, unknown>): Record<string, string> | undefined {
  if (!input) return undefined
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(input)) {
    if (key !== 'gameId' && key !== 'planId') continue
    if (typeof value !== 'string' || !METRIKA_SAFE_ID.test(value)) continue
    out[key] = value
  }
  return Object.keys(out).length ? out : undefined
}

/** Resolves true only when the goal was actually handed to the tag. */
export async function reachMetrikaGoal(goal: MetrikaGoal, params?: Record<string, unknown>): Promise<boolean> {
  if (!isMetrikaConsentGranted()) return false
  if (goal === 'premium_purchase' && !PREMIUM_PURCHASE_METRIKA_ENABLED) return false
  try {
    await enableYandexMetrika()
    return reachYandexGoal(goal, safeParams(params))
  } catch {
    return false
  }
}

/** Dedupe within a browser tab for identical goal+params keys. */
export async function reachMetrikaGoalOnce(
  goal: MetrikaGoal,
  dedupeKey: string,
  params?: Record<string, unknown>
): Promise<void> {
  const key = `${goal}:${dedupeKey}`
  if (sentGoals.has(key)) return
  // Mark as sent only after delivery, so a goal skipped on a private URL can still count later.
  sentGoals.add(key)
  const delivered = await reachMetrikaGoal(goal, params)
  if (!delivered) sentGoals.delete(key)
}

export function markMetrikaPaymentPending(): void {
  try {
    sessionStorage.setItem(PAY_PENDING_KEY, String(Date.now()))
  } catch {
    /* ignore */
  }
}

export function clearMetrikaPaymentPending(): void {
  try {
    sessionStorage.removeItem(PAY_PENDING_KEY)
  } catch {
    /* ignore */
  }
}

function hasFreshPaymentPending(): boolean {
  try {
    const raw = sessionStorage.getItem(PAY_PENDING_KEY)
    if (!raw) return false
    const started = Number(raw)
    if (!Number.isFinite(started)) return false
    if (Date.now() - started > PAY_PENDING_MAX_MS) {
      sessionStorage.removeItem(PAY_PENDING_KEY)
      return false
    }
    return true
  } catch {
    return false
  }
}

/**
 * Intended for a confirmed NEW payment only.
 * Currently a no-op (clears pending) while PREMIUM_PURCHASE_METRIKA_ENABLED is false.
 */
export async function reportMetrikaPremiumPurchaseConfirmed(): Promise<void> {
  const hadPending = hasFreshPaymentPending()
  clearMetrikaPaymentPending()
  if (!PREMIUM_PURCHASE_METRIKA_ENABLED) return
  if (!isMetrikaConsentGranted()) return
  if (!hadPending) return
  // When re-enabled: require an API-proven new grant before this line.
  await reachMetrikaGoal('premium_purchase')
}

/** Map existing first-party event names to Metrika goals when useful. */
export function mirrorTrackEventToMetrika(name: string, props?: Record<string, unknown>): void {
  if (!isMetrikaConsentGranted()) return
  if (name === 'start_game') {
    void reachMetrikaGoal('game_start', props)
    return
  }
  if (name === 'click_premium') {
    // Same key as the /premium route view: one premium_view per tab, not one per entry point.
    void reachMetrikaGoalOnce('premium_view', 'view')
    return
  }
  if (name === 'yookassa_redirect') {
    markMetrikaPaymentPending()
    void reachMetrikaGoal('premium_payment_start', props)
  }
}

export function resetMetrikaGoalsForTests(): void {
  sentGoals.clear()
  clearMetrikaPaymentPending()
}

export function assertGoalName(name: string): MetrikaGoal {
  if (!isMetrikaGoal(name)) throw new Error(`unknown metrika goal: ${name}`)
  return name
}