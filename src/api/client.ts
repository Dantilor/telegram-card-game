import { resolveApiBase } from '../lib/apiBase'
import { getInitData } from '../lib/telegram'
import { isWebShell } from '../config/shell'
import { csrfHeadersForMutation } from '../lib/csrf'

export async function apiFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase()
  const headers = new Headers(options.headers ?? {})
  headers.set('Content-Type', 'application/json')
  if (!isWebShell()) {
    const initData = getInitData()
    if (initData) headers.set('x-telegram-init-data', initData)
  }
  const csrf = csrfHeadersForMutation(method)
  for (const [k, v] of Object.entries(csrf)) headers.set(k, v)

  const url = path.startsWith('http') ? path : `${resolveApiBase(import.meta.env)}${path}`
  const res = await fetch(url, {
    ...options,
    method,
    headers,
    credentials: isWebShell() ? 'include' : 'omit',
  })

  if (!res.ok) {
    const text = await res.text()
    const err = new Error(`API ${res.status}: ${text}`) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return res.json() as Promise<T>
}

export function getApiBaseUrl(): string {
  return resolveApiBase(import.meta.env)
}
