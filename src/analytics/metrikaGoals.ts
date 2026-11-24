/**
 * Typed Metrika goals + purchase dedupe.
 * Never pass email, telegram id, tokens, payment ids, or form contents.
 */

import { isMetrikaGoal, METRIKA_SAFE_ID, type MetrikaGoal } from './metrikaConfig'
import { isMetrikaConsentGranted } from './metrikaConsent'
import { enableYandexMetrika, reachYandexGoal } from './yandexMetrika'

const PAY_PENDING_KEY = 'gnh_metrika_pay_pending'
const PURCHASE_SENT_KEY = 'gnh_metrika_purchase_sent'
const PAY_PENDING_MAX_MS = 6 * 60 * 60 * 1000

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

export async function reachMetrikaGoal(goal: MetrikaGoal, params?: Record<string, unknown>): Promise<void> {
  if (!isMetrikaConsentGranted()) return
  try {
    await enableYandexMetrika()
    reachYandexGoal(goal, safeParams(params))
  } catch {
    /* ignore */
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
  sentGoals.add(key)
  await reachMetrikaGoal(goal, params)
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

function alreadySentPurchase(): boolean {
  try {
    return Boolean(sessionStorage.getItem(PURCHASE_SENT_KEY))
  } catch {
    return false
  }
}

function markPurchaseSent(): void {
  try {
    sessionStorage.setItem(PURCHASE_SENT_KEY, String(Date.now()))
    sessionStorage.removeItem(PAY_PENDING_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * Fire premium_purchase only after confirmed Premium AND a checkout we started.
 * Ignores restore-only refreshes and bare return_url reloads without pending intent.
 */
export async function reportMetrikaPremiumPurchaseConfirmed(): Promise<void> {
  if (!isMetrikaConsentGranted()) return
  if (alreadySentPurchase()) return
  if (!hasFreshPaymentPending()) return
  markPurchaseSent()
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
    void reachMetrikaGoalOnce('premium_view', 'click')
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
  try {
    sessionStorage.removeItem(PURCHASE_SENT_KEY)
  } catch {
    /* ignore */
  }
}

export function assertGoalName(name: string): MetrikaGoal {
  if (!isMetrikaGoal(name)) throw new Error(`unknown metrika goal: ${name}`)
  return name
}