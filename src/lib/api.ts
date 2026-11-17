import { resolveApiBase } from './apiBase'
import { getInitData } from './telegram'
import { waitForInitData } from './waitForInitData'
import { fetchGetWithRetry, parseRetryAfterMs, type FetchGetRetryOptions, type GetRetryProfile } from './fetchWithRetry'

const API_TIMEOUT_MS = 7000
const isDev = import.meta.env.DEV

/** Public reads: sent as CORS-simple GETs (no Telegram header), so no preflight. */
const PUBLIC_GET_PATHS = new Set(['/api/plans', '/api/public-stats'])

/** Authenticated cold-start reads that should fail fast on a dead VPN path. */
const CRITICAL_GET_PATHS = new Set(['/api/me', '/api/legal/me'])

export type ApiError = Error & { status?: number; retryAfterMs?: number }

export function getBaseUrl(): string {
  return resolveApiBase(import.meta.env)
}

function defaultProfileFor(path: string): GetRetryProfile {
  return CRITICAL_GET_PATHS.has(path) ? 'critical' : 'background'
}

async function request<T>(
  path: string,
  options: RequestInit & { method?: string; body?: string; retry?: FetchGetRetryOptions } = {}
): Promise<T> {
  const baseUrl = getBaseUrl()
  const isGet = (options.method ?? 'GET').toUpperCase() === 'GET'
  const publicRead = isGet && PUBLIC_GET_PATHS.has(path)
  // The Telegram SDK is intentionally async. A game can be tapped before
  // initData arrives; wait for the signed session instead of returning a false
  // 401 or sending an anonymous room/payment POST. Public reads stay instant.
  const initData = publicRead ? null : (getInitData() || await waitForInitData(3_500))
  // No protected request (GET or POST) is sent without Telegram auth.
  if (!publicRead && !initData) {
    const err = new Error('API 401: initData required') as ApiError
    err.status = 401
    throw err
  }

  const headers: Record<string, string> = {
    // A GET has no body; Content-Type on it would only force a CORS preflight.
    ...(isGet ? { Accept: 'application/json' } : { 'Content-Type': 'application/json' }),
    ...(typeof options.headers === 'object' && !(options.headers instanceof Headers)
      ? (options.headers as Record<string, string>)
      : {}),
  }
  if (initData) {
    headers['x-telegram-init-data'] = initData
  }

  const url = path.startsWith('http') ? path : `${baseUrl}${path}`
  let res: Response
  try {
    const init: RequestInit = {
      ...options,
      headers,
      credentials: 'omit',
    }
    if (isGet) {
      const retry = {
        profile: defaultProfileFor(path),
        ...options.retry,
      }
      res = await fetchGetWithRetry(url, init, fetch, retry)
    } else {
      // Never retry POST: it can create a payment or record legal consent.
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS)
      const external = options.signal
      const forwardAbort = () => controller.abort()
      external?.addEventListener('abort', forwardAbort, { once: true })
      try {
        res = await fetch(url, { ...init, signal: controller.signal })
      } finally {
        clearTimeout(timeoutId)
        external?.removeEventListener('abort', forwardAbort)
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch'
    if (isDev) console.warn('[TCG] API fetch failed:', msg)
    throw new Error(`Сеть недоступна: ${msg}`) as ApiError
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const err = new Error(`API ${res.status}: ${text}`) as ApiError
    err.status = res.status
    const retryAfterMs = parseRetryAfterMs(res.headers.get('Retry-After'))
    if (retryAfterMs !== null) err.retryAfterMs = retryAfterMs
    throw err
  }
  return res.json() as Promise<T>
}

export async function apiGet<T = unknown>(
  path: string,
  options: { signal?: AbortSignal; retry?: FetchGetRetryOptions } = {}
): Promise<T> {
  return request<T>(path, { method: 'GET', signal: options.signal, retry: options.retry })
}

export async function apiPost<T = unknown>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
