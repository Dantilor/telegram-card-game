/**
 * Non-blocking Telegram WebApp SDK loader.
 *
 * Loads same-origin `telegram-web-app.js` without a synchronous <script> in <head>,
 * so a slow download cannot stall HTML parse / first React paint.
 * Dispatches `gnh:telegram-sdk-ready` once window.Telegram.WebApp exists.
 * Never invents initData or user identity.
 */

export const TELEGRAM_SDK_READY_EVENT = 'gnh:telegram-sdk-ready'
export const TELEGRAM_SDK_FAILED_EVENT = 'gnh:telegram-sdk-failed'

export type TelegramSdkStatus = 'idle' | 'loading' | 'ready' | 'failed'

type TelegramSdkWindow = Window & {
  Telegram?: { WebApp?: unknown }
  __GNH_TG_SDK__?: {
    status: TelegramSdkStatus
    promise?: Promise<boolean>
  }
}

function sdkWindow(): TelegramSdkWindow | null {
  if (typeof window === 'undefined') return null
  return window as TelegramSdkWindow
}

export function isTelegramSdkReady(): boolean {
  const w = sdkWindow()
  return Boolean(w?.Telegram?.WebApp)
}

export function getTelegramSdkStatus(): TelegramSdkStatus {
  const w = sdkWindow()
  if (!w) return 'idle'
  if (w.Telegram?.WebApp) return 'ready'
  return w.__GNH_TG_SDK__?.status ?? 'idle'
}

function mark(status: TelegramSdkStatus): void {
  const w = sdkWindow()
  if (!w) return
  w.__GNH_TG_SDK__ = { ...(w.__GNH_TG_SDK__ ?? { status: 'idle' }), status }
}

function dispatchReady(): void {
  const w = sdkWindow()
  if (!w) return
  mark('ready')
  w.dispatchEvent(new CustomEvent(TELEGRAM_SDK_READY_EVENT))
}

function dispatchFailed(reason: string): void {
  const w = sdkWindow()
  if (!w) return
  mark('failed')
  w.dispatchEvent(new CustomEvent(TELEGRAM_SDK_FAILED_EVENT, { detail: { reason } }))
}

function scriptSrc(): string {
  // Prefer Vite base so GitHub Pages (/telegram-card-game/) and Timeweb Static (/) both work.
  const base = typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : './'
  const normalized = base.endsWith('/') ? base : `${base}/`
  return `${normalized}telegram-web-app.js`
}

/**
 * Start loading the official WebApp script from our static host (not telegram.org).
 * Safe to call multiple times; shares one promise.
 */
export function ensureTelegramSdkLoaded(): Promise<boolean> {
  const w = sdkWindow()
  if (!w) return Promise.resolve(false)
  if (w.Telegram?.WebApp) {
    mark('ready')
    return Promise.resolve(true)
  }
  if (w.__GNH_TG_SDK__?.promise) return w.__GNH_TG_SDK__.promise

  mark('loading')
  const promise = new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-gnh-telegram-sdk="1"]')
    if (existing) {
      const finish = () => {
        if (w.Telegram?.WebApp) {
          dispatchReady()
          resolve(true)
        } else {
          dispatchFailed('script-present-without-webapp')
          resolve(false)
        }
      }
      if (w.Telegram?.WebApp) {
        finish()
        return
      }
      existing.addEventListener('load', finish, { once: true })
      existing.addEventListener(
        'error',
        () => {
          dispatchFailed('script-error')
          resolve(false)
        },
        { once: true }
      )
      return
    }

    const script = document.createElement('script')
    script.src = scriptSrc()
    script.async = true
    script.dataset.gnhTelegramSdk = '1'
    script.addEventListener(
      'load',
      () => {
        if (w.Telegram?.WebApp) {
          dispatchReady()
          resolve(true)
        } else {
          // Script executed but WebApp missing (opened outside Telegram) — not a hard failure for UI.
          dispatchFailed('webapp-missing')
          resolve(false)
        }
      },
      { once: true }
    )
    script.addEventListener(
      'error',
      () => {
        dispatchFailed('network-or-parse')
        resolve(false)
      },
      { once: true }
    )
    document.head.appendChild(script)
  })

  w.__GNH_TG_SDK__ = { status: 'loading', promise }
  return promise
}

/** Resolve when WebApp exists, or after timeout (false). Does not fabricate initData. */
export function whenTelegramSdkReady(timeoutMs = 8_000): Promise<boolean> {
  if (isTelegramSdkReady()) return Promise.resolve(true)
  ensureTelegramSdkLoaded().catch(() => undefined)
  return new Promise((resolve) => {
    let settled = false
    const done = (ok: boolean) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(ok)
    }
    const onReady = () => done(true)
    const onFailed = () => done(isTelegramSdkReady())
    const cleanup = () => {
      window.removeEventListener(TELEGRAM_SDK_READY_EVENT, onReady)
      window.removeEventListener(TELEGRAM_SDK_FAILED_EVENT, onFailed)
      window.clearTimeout(timer)
    }
    window.addEventListener(TELEGRAM_SDK_READY_EVENT, onReady)
    window.addEventListener(TELEGRAM_SDK_FAILED_EVENT, onFailed)
    const timer = window.setTimeout(() => done(isTelegramSdkReady()), timeoutMs)
    ensureTelegramSdkLoaded()
      .then((ok) => {
        if (ok || isTelegramSdkReady()) done(true)
      })
      .catch(() => undefined)
  })
}

export function subscribeTelegramSdkReady(onReady: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  if (isTelegramSdkReady()) {
    queueMicrotask(onReady)
    return () => undefined
  }
  ensureTelegramSdkLoaded().catch(() => undefined)
  const handler = () => onReady()
  window.addEventListener(TELEGRAM_SDK_READY_EVENT, handler)
  return () => window.removeEventListener(TELEGRAM_SDK_READY_EVENT, handler)
}
