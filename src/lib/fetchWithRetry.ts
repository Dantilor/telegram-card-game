/**
 * Retry transient GET failures only. Never use for payment creation, consent
 * writes, or any other non-idempotent request.
 *
 * A slow Telegram WebView / VPN startup may produce brief network failures,
 * 429, or 5xx responses. Retrying bounded GETs keeps Premium content usable
 * without disabling offer acceptance or inventing plans/prices.
 */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504])
const MAX_ATTEMPTS = 3
const ATTEMPT_TIMEOUT_MS = 9_000
const RETRY_DELAY_MS = [450, 1_100]
/** A longer server-requested pause is left to the caller's recovery schedule. */
const MAX_INLINE_RETRY_AFTER_MS = 3_000

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

export async function fetchGetWithRetry(
  url: string,
  init: RequestInit = {},
  fetchImpl: FetchLike = fetch
): Promise<Response> {
  if ((init.method ?? 'GET').toUpperCase() !== 'GET') {
    throw new Error('fetchGetWithRetry accepts GET requests only')
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController()
    const externalSignal = init.signal
    if (externalSignal?.aborted) {
      throw new Error('Request aborted')
    }
    const forwardAbort = () => controller.abort()
    externalSignal?.addEventListener('abort', forwardAbort, { once: true })
    const timeout = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS)
    let waitMs = RETRY_DELAY_MS[attempt] ?? 1_100

    try {
      const response = await fetchImpl(url, {
        ...init,
        method: 'GET',
        signal: controller.signal,
      })
      if (!RETRYABLE_STATUSES.has(response.status) || attempt === MAX_ATTEMPTS - 1) {
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
      if (externalSignal?.aborted || attempt === MAX_ATTEMPTS - 1) {
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
