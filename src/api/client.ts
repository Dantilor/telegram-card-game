import { getTg } from '../utils/telegram'

const baseURL = ''

export function tgHeaders(): Record<string, string> {
  const tg = getTg()
  const initData = tg?.initData
  if (!initData) return {}
  return { 'X-Telegram-Init-Data': initData }
}

export async function fetchJSON<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = path.startsWith('http') ? path : `${baseURL}${path}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...tgHeaders(),
    ...(typeof options.headers === 'object' && !(options.headers instanceof Headers)
      ? (options.headers as Record<string, string>)
      : {}),
  }
  const res = await fetch(url, { ...options, headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error?: string }).error ?? res.statusText)
  }
  return res.json() as Promise<T>
}
