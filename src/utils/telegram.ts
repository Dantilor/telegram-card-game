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

import { getCachedInitData, parseAndCacheFromHash } from './telegramInitCache'

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
  const cached = getCachedInitData()
  if (cached) return cached
  const fromHash = parseAndCacheFromHash()
  if (fromHash) return fromHash
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
