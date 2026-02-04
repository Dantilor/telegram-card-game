const API_BASE_URL = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE ||
  'https://telegram-card-game.onrender.com'
).replace(/\/$/, '')

function getInitData(): string {
  return (typeof window !== 'undefined' && (window as Window & { Telegram?: { WebApp?: { initData?: string } } })?.Telegram?.WebApp?.initData) || ''
}

export async function apiFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const initData = getInitData()
  const headers = new Headers(options.headers ?? {})
  headers.set('Content-Type', 'application/json')
  if (initData) headers.set('x-telegram-init-data', initData)

  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`
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

export function getApiBaseUrl(): string {
  return API_BASE_URL
}
