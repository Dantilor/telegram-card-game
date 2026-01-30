declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string
        ready?: () => void
        expand?: () => void
        setHeaderColor?: (color: string) => void
        openInvoice?: (url: string, cb?: (status: string) => void) => void
        BackButton?: {
          show: () => void
          hide: () => void
          onClick: (cb: () => void) => void
        }
        HapticFeedback?: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy') => void
        }
        initDataUnsafe?: {
          user?: {
            id?: number
            first_name: string
            last_name?: string
            username?: string
            photo_url?: string
          }
          chat?: {
            id?: number
            type?: string
            title?: string
          }
        }
      }
    }
  }
}

export function getTg() {
  return (typeof window !== 'undefined' && (window as any)?.Telegram?.WebApp) ?? null
}

import { getTgHashPayload } from './telegramHash'

export type InitDataFromHash = {
  user?: { id?: number; first_name?: string; last_name?: string; username?: string; photo_url?: string }
  chat_instance?: string
  chat_type?: string
  auth_date?: string
  hash?: string
  raw?: string
}

/** Parse init data from current location.hash (fallback when sessionStorage wasn't used) */
export function parseTgWebAppDataFromHash(): InitDataFromHash | null {
  if (typeof window === 'undefined') return null
  try {
    const hash = window.location.hash.slice(1)
    const queryPart = hash.includes('?') ? hash.split('?').slice(1).join('?') : hash
    const params = new URLSearchParams(queryPart)
    const tgWebAppData = params.get('tgWebAppData')
    if (!tgWebAppData) return null
    const decoded = decodeURIComponent(tgWebAppData)
    const initParams = new URLSearchParams(decoded)
    const userStr = initParams.get('user')
    let user: InitDataFromHash['user'] | undefined
    if (userStr) {
      try {
        user = JSON.parse(decodeURIComponent(userStr)) as InitDataFromHash['user']
      } catch {
        try {
          user = JSON.parse(userStr) as InitDataFromHash['user']
        } catch {
          // ignore
        }
      }
    }
    return {
      user,
      chat_instance: initParams.get('chat_instance') ?? undefined,
      chat_type: initParams.get('chat_type') ?? undefined,
      auth_date: initParams.get('auth_date') ?? undefined,
      hash: initParams.get('hash') ?? undefined,
      raw: decoded,
    }
  } catch {
    return null
  }
}

export type InitData = {
  userId?: number
  user?: { id?: number; first_name?: string; last_name?: string; username?: string; photo_url?: string }
  chatInstance?: string
  chatType?: string
  source: 'telegram' | 'hash' | 'none'
  initDataRaw?: string
  themeParams?: Record<string, string>
}

export function getInitData(): InitData {
  const tg = getTg()
  if (tg?.initDataUnsafe) {
    const u = tg.initDataUnsafe.user
    const c = tg.initDataUnsafe.chat
    const userId = u != null && typeof (u as { id?: number }).id === 'number' ? (u as { id: number }).id : undefined
    return {
      userId: userId ?? (c != null && typeof c.id === 'number' ? c.id : undefined),
      user: u ?? undefined,
      chatInstance: c?.id != null ? String(c.id) : undefined,
      chatType: c?.type,
      source: 'telegram',
      initDataRaw: tg.initData || undefined,
    }
  }
  const payload = getTgHashPayload()
  if (payload?.parsed && (payload.parsed.user || payload.parsed.auth_date)) {
    const userId = payload.parsed.user?.id != null ? payload.parsed.user.id : undefined
    let themeParams: Record<string, string> | undefined
    if (payload.tgWebAppThemeParams) {
      try {
        themeParams = JSON.parse(decodeURIComponent(payload.tgWebAppThemeParams)) as Record<string, string>
      } catch {
        // ignore
      }
    }
    return {
      userId,
      user: payload.parsed.user,
      chatInstance: payload.parsed.chat_instance,
      chatType: payload.parsed.chat_type,
      source: 'hash',
      initDataRaw: payload.parsed.raw ?? payload.tgWebAppData,
      themeParams,
    }
  }
  const fromHash = parseTgWebAppDataFromHash()
  if (fromHash && (fromHash.user || fromHash.auth_date)) {
    const userId = fromHash.user?.id != null ? fromHash.user.id : undefined
    return {
      userId,
      user: fromHash.user,
      chatInstance: fromHash.chat_instance,
      chatType: fromHash.chat_type,
      source: 'hash',
      initDataRaw: fromHash.raw,
    }
  }
  return { source: 'none' }
}

export function getTgUser() {
  const init = getInitData()
  return init.user ?? null
}

/** Safe chat/user id for API; never throws. Prefer user id, fallback to chat id. */
export function getChatId(): number | null {
  const init = getInitData()
  if (init.userId != null) return init.userId
  return null
}

export function readyAndExpand() {
  const tg = getTg()
  if (tg) {
    tg.ready?.()
    tg.expand?.()
  }
}

export function haptic(type: 'light' | 'medium' | 'heavy' = 'light') {
  getTg()?.HapticFeedback?.impactOccurred?.(type)
}

export function setHeaderColor(color: string) {
  getTg()?.setHeaderColor?.(color)
}
