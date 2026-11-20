import { isImmersiveWebPath } from './webChrome'

const DISMISS_KEY = 'gnh_web_install_dismiss_until_v1'
const DISMISS_MS = 14 * 24 * 60 * 60 * 1000
const ENGAGED_KEY = 'gnh_web_install_engaged_v1'

export type BeforeInstallPromptEventLike = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false
  const mq = window.matchMedia?.('(display-mode: standalone)')?.matches
  const ios = 'standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  return Boolean(mq || ios)
}

export function isTelegramWebView(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (window.Telegram?.WebApp?.initData) return true
  } catch {
    /* ignore */
  }
  return /Telegram/i.test(navigator.userAgent || '')
}

export function isIosSafariLike(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return iOS && /WebKit/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua)
}

export function isDismissedRecently(now = Date.now()): boolean {
  try {
    const until = Number(localStorage.getItem(DISMISS_KEY) || 0)
    return Number.isFinite(until) && until > now
  } catch {
    return false
  }
}

export function dismissInstallPrompt(now = Date.now()): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(now + DISMISS_MS))
  } catch {
    /* ignore */
  }
}

export function markInstallEngaged(): void {
  try {
    localStorage.setItem(ENGAGED_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function hasInstallEngaged(): boolean {
  try {
    return localStorage.getItem(ENGAGED_KEY) === '1'
  } catch {
    return false
  }
}

/** Hide automatic install UI during active game / setup flows. */
export function isGameplayPath(pathname: string): boolean {
  return isImmersiveWebPath(pathname)
}

export async function registerWebServiceWorker(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  try {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  } catch {
    /* optional for installability */
  }
}
