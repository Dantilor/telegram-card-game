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

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
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

    try {
      const response = await fetchImpl(url, {
        ...init,
        method: 'GET',
        signal: controller.signal,
      })
      if (!RETRYABLE_STATUSES.has(response.status) || attempt === MAX_ATTEMPTS - 1) {
        return response
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
    await pause(RETRY_DELAY_MS[attempt] ?? 1_100)
  }

  throw new Error('GET request retries exhausted')
}
