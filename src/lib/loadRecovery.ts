import { ApiConfigError } from './apiBase'

/** Pauses between automatic recovery attempts after the first failure. */
export const RECOVERY_DELAYS_MS = [2_000, 4_000, 8_000, 15_000, 30_000] as const
/** Upper bound for a server-requested Retry-After pause. */
const MAX_RETRY_AFTER_MS = 120_000

const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504])
const PERMANENT_CODES = new Set(['api_not_configured', 'api_base_conflict', 'render_fallback_blocked'])

export type LoadFailure = {
  retryable: boolean
  retryAfterMs?: number
}

/**
 * Decide whether a failed GET is worth retrying automatically.
 * Network errors, timeouts, proxy pages, 408/429/5xx recover on their own;
 * configuration errors and 400/401/403/404 need a code or user change.
 */
export function classifyLoadFailure(error: unknown): LoadFailure {
  if (error instanceof ApiConfigError) return { retryable: false }
  const coded = error as { code?: unknown; status?: unknown; retryAfterMs?: unknown } | null
  if (coded && typeof coded.code === 'string' && PERMANENT_CODES.has(coded.code)) return { retryable: false }
  const retryAfterMs = typeof coded?.retryAfterMs === 'number' && coded.retryAfterMs >= 0 ? coded.retryAfterMs : undefined
  const status = typeof coded?.status === 'number' ? coded.status : 0
  if (status === 0) return { retryable: true, retryAfterMs }
  if (RETRYABLE_STATUSES.has(status)) return { retryable: true, retryAfterMs }
  return { retryable: false }
}

/** Delay before the next automatic attempt; `failures` counts failed attempts so far (1-based). */
export function recoveryDelayMs(failures: number, failure: LoadFailure): number {
  const index = Math.min(Math.max(failures, 1), RECOVERY_DELAYS_MS.length) - 1
  const base = RECOVERY_DELAYS_MS[index]
  if (failure.retryAfterMs === undefined) return base
  return Math.max(base, Math.min(failure.retryAfterMs, MAX_RETRY_AFTER_MS))
}
