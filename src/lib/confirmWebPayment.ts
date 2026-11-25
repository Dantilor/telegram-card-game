import { apiPost } from './api'

export type ConfirmOutcome =
  | { kind: 'confirmed'; activeUntil: string | null; alreadyDone: boolean }
  | { kind: 'pending'; status: string | null }
  | { kind: 'canceled' }
  /** 401/403: no session, CSRF lost, or the payment belongs to another WEB account. */
  | { kind: 'session_lost' }
  /** 404: the server has no WEB order with this id. */
  | { kind: 'not_found' }
  /** Network, timeout, 429 or 5xx: worth retrying. */
  | { kind: 'temporary' }
  /** Other 4xx (amount/plan mismatch…): retrying will not help. */
  | { kind: 'rejected'; code: string | null }

type ConfirmBody = {
  ok?: boolean
  status?: string | null
  alreadyDone?: boolean
  activeUntil?: string | null
  error?: string
}

/**
 * Asks the server to confirm a WEB payment. The server re-checks ownership, amount,
 * plan and status against the WEB YooKassa shop and grants Premium at most once.
 * Never retried automatically by the transport (POST); the caller decides.
 */
export async function confirmWebPayment(paymentId: string): Promise<ConfirmOutcome> {
  try {
    const body = await apiPost<ConfirmBody>('/api/yookassa/confirm', { paymentId })
    if (body?.ok === true) {
      return {
        kind: 'confirmed',
        activeUntil: typeof body.activeUntil === 'string' ? body.activeUntil : null,
        alreadyDone: Boolean(body.alreadyDone),
      }
    }
    const status = typeof body?.status === 'string' ? body.status : null
    if (status === 'canceled') return { kind: 'canceled' }
    return { kind: 'pending', status }
  } catch (e) {
    const err = e as Error & { status?: number }
    const status = err.status
    if (status === 401 || status === 403) return { kind: 'session_lost' }
    if (status === 404) return { kind: 'not_found' }
    if (status === undefined || status === 429 || status >= 500) return { kind: 'temporary' }
    const m = /"error"\s*:\s*"([a-z_]+)"/.exec(err.message ?? '')
    return { kind: 'rejected', code: m ? m[1] : null }
  }
}