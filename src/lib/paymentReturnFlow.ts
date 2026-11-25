import type { ConfirmOutcome } from './confirmWebPayment'
import type { PendingWebPayment } from './pendingWebPayment'

export type PaymentReturnPhase =
  | 'idle'
  | 'checking'
  | 'success'
  /** Provider has not finished yet (or is slow); safe to re-check. */
  | 'pending'
  /** Temporary failure (network / provider); safe to re-check. */
  | 'error'
  /** Server refused the payment as inconsistent; do not loop. */
  | 'failed'
  | 'canceled'
  /** Returned without the session that made the purchase. */
  | 'session_lost'

export const PAYMENT_RETURN_ATTEMPTS = 30
export const PAYMENT_RETURN_INTERVAL_MS = 2000

type PremiumSnapshot = { isPremium: boolean } | null

export type PaymentReturnDeps = {
  readPending: () => PendingWebPayment | null
  clearPending: () => void
  confirm: (paymentId: string) => Promise<ConfirmOutcome>
  /** Current WEB session account id, null when there is no session. Throws on network errors. */
  currentAccountId: () => Promise<string | null>
  /** Forces /api/me past every cache and updates the Premium context. */
  refreshPremium: () => Promise<PremiumSnapshot>
  sleep: (ms: number) => Promise<void>
  isActive: () => boolean
  onPhase: (phase: PaymentReturnPhase) => void
  attempts?: number
  intervalMs?: number
}

async function premiumVisible(deps: PaymentReturnDeps, tries: number): Promise<boolean> {
  for (let i = 0; i < tries; i += 1) {
    if (!deps.isActive()) return false
    const snap = await deps.refreshPremium()
    if (snap?.isPremium) return true
    if (i < tries - 1) await deps.sleep(800)
  }
  return false
}

/**
 * Return-from-YooKassa flow. Premium is never assumed: it is shown only after the server
 * confirmed the payment (or /api/me itself reports Premium).
 */
export async function runPaymentReturnFlow(deps: PaymentReturnDeps): Promise<PaymentReturnPhase> {
  const attempts = deps.attempts ?? PAYMENT_RETURN_ATTEMPTS
  const intervalMs = deps.intervalMs ?? PAYMENT_RETURN_INTERVAL_MS
  const finish = (phase: PaymentReturnPhase): PaymentReturnPhase => {
    if (deps.isActive()) deps.onPhase(phase)
    return phase
  }

  deps.onPhase('checking')
  const pending = deps.readPending()

  // No stored order (other browser, or an order created before this flow existed):
  // only /api/me can tell, i.e. wait for the webhook.
  if (!pending) {
    for (let i = 0; i < attempts; i += 1) {
      if (!deps.isActive()) return 'idle'
      const snap = await deps.refreshPremium()
      if (snap?.isPremium) return finish('success')
      if (i < attempts - 1) await deps.sleep(intervalMs)
    }
    return finish('session_lost')
  }

  try {
    const accountId = await deps.currentAccountId()
    if (!accountId || (pending.accountId && pending.accountId !== accountId)) {
      return finish('session_lost')
    }
  } catch {
    // Session lookup failed transiently; the confirm call below is authoritative.
  }

  let last: ConfirmOutcome = { kind: 'temporary' }
  for (let i = 0; i < attempts; i += 1) {
    if (!deps.isActive()) return 'idle'
    last = await deps.confirm(pending.paymentId)
    switch (last.kind) {
      case 'confirmed': {
        const visible = await premiumVisible(deps, 3)
        if (!deps.isActive()) return 'idle'
        if (!visible) return finish('error')
        deps.clearPending()
        return finish('success')
      }
      case 'canceled':
        deps.clearPending()
        return finish('canceled')
      case 'session_lost':
        return finish('session_lost')
      case 'not_found': {
        deps.clearPending()
        const visible = await premiumVisible(deps, 1)
        return finish(visible ? 'success' : 'failed')
      }
      case 'rejected':
        return finish('failed')
      default:
        break
    }
    if (i < attempts - 1) await deps.sleep(intervalMs)
  }
  return finish(last.kind === 'temporary' ? 'error' : 'pending')
}