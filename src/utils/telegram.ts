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
          selectionChanged?: () => void
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
        version?: string
      }
    }
  }
}

type TelegramWebApp = NonNullable<NonNullable<Window['Telegram']>['WebApp']>

export function getTg(): TelegramWebApp | null {
  if (typeof window === 'undefined') return null
  return window.Telegram?.WebApp ?? null
}

import { cacheInitDataFromWebApp, getCachedInitData, parseAndCacheFromHash } from './telegramInitCache'

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
  try {
    const tg = getTg()
    const raw = typeof tg?.initData === 'string' ? tg.initData : ''
    if (raw) cacheInitDataFromWebApp(raw)
    // Prefer signed initData for API. initDataUnsafe alone is not enough for payment.
    if (raw) {
      const cached = getCachedInitData()
      return {
        userId: cached?.userId,
        user: cached?.user,
        chatInstance: cached?.chatInstance,
        chatType: cached?.chatType,
        source: 'telegram',
        initDataRaw: raw,
        themeParams: cached?.themeParams,
      }
    }
    const cached = getCachedInitData()
    if (cached?.initDataRaw) return { ...cached, source: cached.source === 'webapp' ? 'telegram' : cached.source }
    const fromHash = parseAndCacheFromHash()
    if (fromHash?.initDataRaw) return fromHash
    // Last resort: unsafe profile only (no payment auth).
    if (tg?.initDataUnsafe?.user) {
      const u = tg.initDataUnsafe.user
      const c = tg.initDataUnsafe.chat
      const userId = u != null && typeof (u as { id?: number }).id === 'number' ? (u as { id: number }).id : undefined
      return {
        userId: userId ?? (c != null && typeof c.id === 'number' ? c.id : undefined),
        user: u ?? undefined,
        chatInstance: c?.id != null ? String(c.id) : undefined,
        chatType: c?.type,
        source: 'telegram',
        initDataRaw: undefined,
      }
    }
  } catch {
    // ignore
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
    if (typeof tg.initData === 'string' && tg.initData) {
      cacheInitDataFromWebApp(tg.initData)
    }
  }
}

export function haptic(type: 'light' | 'medium' | 'heavy' = 'light') {
  const tg = getTg()
  if (tg && parseFloat(tg.version || '0') > 6) {
    tg.HapticFeedback?.impactOccurred?.(type)
  }
}

export function setHeaderColor(color: string) {
  getTg()?.setHeaderColor?.(color)
}
