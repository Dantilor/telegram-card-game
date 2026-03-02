/**
 * Safe access to Telegram WebApp SDK.
 * Requires script: https://telegram.org/js/telegram-web-app.js
 */

import { getCachedInitData } from '../utils/telegramInitCache'

export function getTelegramWebApp(): {
  initData?: string
  ready?: () => void
  expand?: () => void
  openInvoice?: (url: string, cb?: (status: string) => void) => void
  openTelegramLink?: (url: string) => void
  openLink?: (url: string) => void
} | null {
  try {
    const w = typeof window !== 'undefined' ? window : null
    return (w as Window & { Telegram?: { WebApp?: unknown } })?.Telegram?.WebApp ?? null
  } catch {
    return null
  }
}

/** Raw initData для API. При обновлении страницы WebApp.initData может быть пуст — берём из кэша. */
export function getInitData(): string {
  const tg = getTelegramWebApp()
  const fromTg = (tg && typeof tg.initData === 'string' ? tg.initData : '') || ''
  if (fromTg) return fromTg
  const cached = getCachedInitData()
  return cached?.initDataRaw ?? ''
}

let readyCalled = false

export function initTelegram(): void {
  if (readyCalled) return
  readyCalled = true
  const tg = getTelegramWebApp()
  if (tg?.ready) {
    try {
      tg.ready()
    } catch {
      // no-op
    }
  }
  if (tg?.expand) {
    try {
      tg.expand()
    } catch {
      // no-op
    }
  }
}
