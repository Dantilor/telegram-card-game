import { resolveApiBase } from './apiBase'
import { getInitData } from './telegram'
import { fetchGetWithRetry, parseRetryAfterMs } from './fetchWithRetry'

const API_TIMEOUT_MS = 7000
const isDev = import.meta.env.DEV

/** Public reads: sent as CORS-simple GETs (no Telegram header), so no preflight. */
const PUBLIC_GET_PATHS = new Set(['/api/plans', '/api/public-stats'])

export type ApiError = Error & { status?: number; retryAfterMs?: number }

export function getBaseUrl(): string {
  return resolveApiBase(import.meta.env)
}

async function request<T>(path: string, options: RequestInit & { method?: string; body?: string } = {}): Promise<T> {
  const baseUrl = getBaseUrl()
  const isGet = (options.method ?? 'GET').toUpperCase() === 'GET'
  const publicRead = isGet && PUBLIC_GET_PATHS.has(path)
  const initData = publicRead ? null : getInitData()
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
      // Public data loads can fail transiently when Telegram starts through a VPN.
      res = await fetchGetWithRetry(url, init)
    } else {
      // Never retry POST: it can create a payment or record legal consent.
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS)
      try {
        res = await fetch(url, { ...init, signal: controller.signal })
      } finally {
        clearTimeout(timeoutId)
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

export async function apiGet<T = unknown>(path: string, options: { signal?: AbortSignal } = {}): Promise<T> {
  return request<T>(path, { method: 'GET', signal: options.signal })
}

export async function apiPost<T = unknown>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
