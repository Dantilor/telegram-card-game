/**
 * Safe access to Telegram WebApp SDK.
 * Script is loaded async from same-origin `telegram-web-app.js` via `telegramSdk.ts`.
 */

import { cacheInitDataFromWebApp, getCachedInitData } from '../utils/telegramInitCache'

export function getTelegramWebApp(): {
  initData?: string
  initDataUnsafe?: {
    start_param?: string
    user?: {
      id?: number
      first_name?: string
      last_name?: string
      username?: string
      photo_url?: string
    }
    chat?: { id?: number; type?: string; title?: string }
  }
  ready?: () => void
  expand?: () => void
  openInvoice?: (url: string, cb?: (status: string) => void) => void
  openTelegramLink?: (url: string) => void
  openLink?: (url: string) => void
} | null {
  try {
    const w = typeof window !== 'undefined' ? window : null
    const tg = (w as Window & { Telegram?: { WebApp?: unknown } })?.Telegram?.WebApp
    return (tg ?? null) as {
      initData?: string
      initDataUnsafe?: {
        start_param?: string
        user?: {
          id?: number
          first_name?: string
          last_name?: string
          username?: string
          photo_url?: string
        }
        chat?: { id?: number; type?: string; title?: string }
      }
      ready?: () => void
      expand?: () => void
      openInvoice?: (url: string, cb?: (status: string) => void) => void
      openTelegramLink?: (url: string) => void
      openLink?: (url: string) => void
    } | null
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
 * One-time Mini App startapp payload from signed initData (preferred) or WebApp field.
 * Do not treat this as proof of identity — identity comes from verified initData on the server.
 */
export function getTelegramStartParam(): string {
  const initData = getInitData()
  if (initData) {
    try {
      const fromSigned = new URLSearchParams(initData).get('start_param')
      if (fromSigned) return fromSigned.trim()
    } catch {
      /* ignore */
    }
  }
  const tg = getTelegramWebApp()
  const unsafe = tg?.initDataUnsafe?.start_param
  return typeof unsafe === 'string' ? unsafe.trim() : ''
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
