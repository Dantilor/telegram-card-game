import { resolveApiBase } from './apiBase'
import { getInitData } from './telegram'
import { waitForInitData } from './waitForInitData'

function apiBase(): string {
  return resolveApiBase({
    VITE_API_URL: import.meta.env.VITE_API_URL,
    VITE_API_BASE: import.meta.env.VITE_API_BASE,
  })
}

/**
 * Complete WEB↔Telegram Premium link from Mini App.
 * Sends signed initData + one-time startapp token. Never trusts client telegram id.
 */
export async function completeTelegramWebLink(token: string): Promise<{
  ok: boolean
  linked?: boolean
  isPremium?: boolean
  premium?: boolean
  activeUntil?: string | null
  sources?: string[]
}> {
  const initData = getInitData() || (await waitForInitData(3500))
  if (!initData) {
    const err = new Error('telegram_init_required') as Error & { status?: number; code?: string }
    err.status = 401
    err.code = 'telegram_init_required'
    throw err
  }
  const res = await fetch(`${apiBase()}/api/web/telegram-link/complete`, {
    method: 'POST',
    credentials: 'omit',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-telegram-init-data': initData,
    },
    body: JSON.stringify({ token: token.trim() }),
  })
  if (!res.ok) {
    const err = new Error('telegram_link_complete_failed') as Error & { status?: number; code?: string }
    err.status = res.status
    try {
      const body = (await res.json()) as { code?: string }
      if (typeof body.code === 'string') err.code = body.code
    } catch {
      /* ignore */
    }
    if (!err.code && res.status === 401) err.code = 'telegram_init_required'
    throw err
  }
  return (await res.json()) as {
    ok: boolean
    linked?: boolean
    isPremium?: boolean
    premium?: boolean
    activeUntil?: string | null
    sources?: string[]
  }
}
