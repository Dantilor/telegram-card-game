import { resolveApiBase } from './apiBase'
import { getInitData } from './telegram'

const API_TIMEOUT_MS = 7000
const isDev = import.meta.env.DEV

export function getBaseUrl(): string {
  return resolveApiBase(import.meta.env)
}

async function request<T>(path: string, options: RequestInit & { method?: string; body?: string } = {}): Promise<T> {
  const baseUrl = getBaseUrl()
  const initData = getInitData()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(typeof options.headers === 'object' && !(options.headers instanceof Headers)
      ? (options.headers as Record<string, string>)
      : {}),
  }
  if (initData) {
    headers['x-telegram-init-data'] = initData
  }

  const url = path.startsWith('http') ? path : `${baseUrl}${path}`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(url, {
      ...options,
      headers,
      credentials: 'omit',
      signal: controller.signal,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch'
    if (isDev) console.warn('[TCG] API fetch failed:', msg)
    throw new Error(`Сеть недоступна: ${msg}`) as Error & { status?: number }
  } finally {
    clearTimeout(timeoutId)
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const err = new Error(`API ${res.status}: ${text}`) as Error & { status?: number }
    ;(err as Error & { status: number }).status = res.status
    throw err
  }
  return res.json() as Promise<T>
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' })
}

export async function apiPost<T = unknown>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
