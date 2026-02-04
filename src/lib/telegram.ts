/**
 * Safe access to Telegram WebApp SDK.
 * Requires script: https://telegram.org/js/telegram-web-app.js
 */

export function getTelegramWebApp(): { initData?: string; ready?: () => void; expand?: () => void; openInvoice?: (url: string, cb?: (status: string) => void) => void } | null {
  try {
    const w = typeof window !== 'undefined' ? window : null
    return (w as Window & { Telegram?: { WebApp?: unknown } })?.Telegram?.WebApp ?? null
  } catch {
    return null
  }
}

export function getInitData(): string {
  const tg = getTelegramWebApp()
  return (tg && typeof tg.initData === 'string' ? tg.initData : '') || ''
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
