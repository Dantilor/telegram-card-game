/**
 * Unified API client for backend on Render.
 */

import { getInitData } from './telegram'

const BASE_URL = (
  import.meta.env.VITE_API_URL ||
  'https://telegram-card-game.onrender.com'
).replace(/\/$/, '')

export function getBaseUrl(): string {
  return BASE_URL
}

async function request<T>(path: string, options: RequestInit & { method?: string; body?: string } = {}): Promise<T> {
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

  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`
  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'omit',
  })

  if (!res.ok) {
    const text = await res.text()
    const err = new Error(`API ${res.status}: ${text}`) as Error & { status?: number }
    err.status = res.status
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
