import { getInitData } from '../utils/telegram'

const baseURL = import.meta.env.VITE_API_BASE ?? ''
const isDev = import.meta.env.DEV

const FETCH_TIMEOUT_MS = 10000

export function tgHeaders(): Record<string, string> {
  const init = getInitData()
  const initData = init.initDataRaw
  if (!initData) return {}
  return { 'X-Telegram-Init-Data': initData }
}

export async function fetchJSON<T = unknown>(
  path: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
  const { timeoutMs = FETCH_TIMEOUT_MS, ...fetchOptions } = options
  const url = path.startsWith('http') ? path : `${baseURL}${path}`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...tgHeaders(),
    ...(typeof fetchOptions.headers === 'object' && !(fetchOptions.headers instanceof Headers)
      ? (fetchOptions.headers as Record<string, string>)
      : {}),
  }

  try {
    const res = await fetch(url, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error((err as { error?: string }).error ?? res.statusText)
    }
    return res.json() as Promise<T>
  } catch (e) {
    clearTimeout(timeoutId)
    if (e instanceof Error && e.name === 'AbortError' && isDev) {
      console.warn('[TCG] API timeout:', path)
    }
    throw e
  }
}
