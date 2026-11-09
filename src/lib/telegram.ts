/**
 * Safe access to Telegram WebApp SDK.
 * Requires script: https://telegram.org/js/telegram-web-app.js
 */

import { cacheInitDataFromWebApp, getCachedInitData } from '../utils/telegramInitCache'

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

/**
 * Local preview only. Production builds drop this branch.
 * A guest window uses ?play=guest and sends no initData.
 * The value is a signed local initData, still checked by the server.
 */
function localPreviewInitData(): string {
  if (!import.meta.env.DEV || typeof window === 'undefined') return ''
  const play = new URLSearchParams(window.location.search).get('play')
  if (play === 'guest') return ''
  const value = import.meta.env.VITE_DEV_INIT_DATA
  return typeof value === 'string' ? value : ''
}

/** Raw initData для API. При обновлении страницы WebApp.initData может быть пуст — берём из кэша. */
export function getInitData(): string {
  const tg = getTelegramWebApp()
  const fromTg = (tg && typeof tg.initData === 'string' ? tg.initData : '') || ''
  if (fromTg) {
    cacheInitDataFromWebApp(fromTg)
    return fromTg
  }
  const preview = localPreviewInitData()
  if (preview) return preview
  const cached = getCachedInitData()
  return cached?.initDataRaw ?? ''
}

/**
 * Best-effort refresh before payment. Telegram may expose WebApp before initData is filled.
 * Does not log initData.
 */
export async function ensureInitData(timeoutMs = 800): Promise<string> {
  const existing = getInitData()
  if (existing) return existing
  const tg = getTelegramWebApp()
  if (!tg) return ''
  try {
    tg.ready?.()
  } catch {
    // no-op
  }
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const raw = typeof tg.initData === 'string' ? tg.initData : ''
    if (raw) {
      cacheInitDataFromWebApp(raw)
      return raw
    }
    await new Promise((r) => setTimeout(r, 50))
  }
  return getInitData()
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
  const raw = typeof tg?.initData === 'string' ? tg.initData : ''
  if (raw) cacheInitDataFromWebApp(raw)
}
