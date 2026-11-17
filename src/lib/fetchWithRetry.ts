/**
 * Retry transient GET failures only. Never use for payment creation, consent
 * writes, or any other non-idempotent request.
 *
 * A slow Telegram WebView / VPN startup may produce brief network failures,
 * 429, or 5xx responses. Retrying bounded GETs keeps Premium content usable
 * without disabling offer acceptance or inventing plans/prices.
 */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

export type GetRetryProfile = 'critical' | 'background'

export type FetchGetRetryOptions = {
  /** Named budgets for cold-start vs background refresh. */
  profile?: GetRetryProfile
  maxAttempts?: number
  attemptTimeoutMs?: number
  retryDelayMs?: number[]
}

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504])
/** A longer server-requested pause is left to the caller's recovery schedule. */
const MAX_INLINE_RETRY_AFTER_MS = 3_000

const PROFILES: Record<
  GetRetryProfile,
  { maxAttempts: number; attemptTimeoutMs: number; retryDelayMs: number[] }
> = {
  // Auth /me and legal/me: fail fast so Home is not held by a dead VPN path.
  critical: { maxAttempts: 2, attemptTimeoutMs: 4_000, retryDelayMs: [400] },
  // Plans / public docs: can retry a bit longer in the background after paint.
  background: { maxAttempts: 3, attemptTimeoutMs: 5_000, retryDelayMs: [450, 1_100] },
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Retry-After as milliseconds (delta-seconds or HTTP date), or null. */
export function parseRetryAfterMs(value: string | null, now = Date.now()): number | null {
  if (!value) return null
  const trimmed = value.trim()
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000
  const date = Date.parse(trimmed)
  if (Number.isNaN(date)) return null
  return Math.max(0, date - now)
}

export function resolveGetRetryBudget(options: FetchGetRetryOptions = {}) {
  const base = PROFILES[options.profile ?? 'background']
  return {
    maxAttempts: options.maxAttempts ?? base.maxAttempts,
    attemptTimeoutMs: options.attemptTimeoutMs ?? base.attemptTimeoutMs,
    retryDelayMs: options.retryDelayMs ?? base.retryDelayMs,
  }
}

export async function fetchGetWithRetry(
  url: string,
  init: RequestInit = {},
  fetchImpl: FetchLike = fetch,
  options: FetchGetRetryOptions = {}
): Promise<Response> {
  if ((init.method ?? 'GET').toUpperCase() !== 'GET') {
    throw new Error('fetchGetWithRetry accepts GET requests only')
  }

  const { maxAttempts, attemptTimeoutMs, retryDelayMs } = resolveGetRetryBudget(options)

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController()
    const externalSignal = init.signal
    if (externalSignal?.aborted) {
      throw new Error('Request aborted')
    }
    const forwardAbort = () => controller.abort()
    externalSignal?.addEventListener('abort', forwardAbort, { once: true })
    const timeout = setTimeout(() => controller.abort(), attemptTimeoutMs)
    let waitMs = retryDelayMs[attempt] ?? retryDelayMs[retryDelayMs.length - 1] ?? 1_100

    try {
      const response = await fetchImpl(url, {
        ...init,
        method: 'GET',
        signal: controller.signal,
      })
      if (!RETRYABLE_STATUSES.has(response.status) || attempt === maxAttempts - 1) {
        return response
      }
      if (response.status === 429) {
        const retryAfter = parseRetryAfterMs(response.headers.get('Retry-After'))
        if (retryAfter !== null && retryAfter > MAX_INLINE_RETRY_AFTER_MS) return response
        if (retryAfter !== null) waitMs = Math.max(waitMs, retryAfter)
      }
      // Release the response body before retrying a failed status.
      await response.body?.cancel().catch(() => undefined)
    } catch (error) {
      if (externalSignal?.aborted || attempt === maxAttempts - 1) {
        throw error
      }
    } finally {
      clearTimeout(timeout)
      externalSignal?.removeEventListener('abort', forwardAbort)
    }

    if (externalSignal?.aborted) {
      throw new Error('Request aborted')
    }
    await pause(waitMs)
  }

  throw new Error('GET request retries exhausted')
}
