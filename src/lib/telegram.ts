/**
 * Safe access to Telegram WebApp SDK.
 * Script is loaded async from same-origin `telegram-web-app.js` via `telegramSdk.ts`.
 */

import { getCachedInitData } from '../utils/telegramInitCache'

export function getTelegramWebApp(): {
  initData?: string
  initDataUnsafe?: {
    start_param?: string
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
      initDataUnsafe?: { start_param?: string }
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
  if (fromTg) return fromTg
  const preview = localPreviewInitData()
  if (preview) return preview
  const cached = getCachedInitData()
  return cached?.initDataRaw ?? ''
}

const LAUNCH_START_PARAM_KEY = 'gnh_tg_launch_start_param'
const CONSUMED_START_PARAMS_KEY = 'gnh_tg_consumed_start_params'

function rememberLaunchStartParam(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  try {
    sessionStorage.setItem(LAUNCH_START_PARAM_KEY, trimmed)
  } catch {
    /* ignore */
  }
  return trimmed
}

function readRememberedLaunchStartParam(): string {
  try {
    const value = sessionStorage.getItem(LAUNCH_START_PARAM_KEY)
    return typeof value === 'string' ? value.trim() : ''
  } catch {
    return ''
  }
}

function readConsumedStartParams(): string[] {
  try {
    const raw = sessionStorage.getItem(CONSUMED_START_PARAMS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  } catch {
    return []
  }
}

export function isTelegramStartParamConsumed(token: string): boolean {
  const trimmed = token.trim()
  if (!trimmed) return false
  return readConsumedStartParams().includes(trimmed)
}

/**
 * Mark a one-time startapp token as finished after successful WEB link.
 * Does not touch signed initData / Telegram auth caches.
 */
export function markTelegramStartParamConsumed(token: string): void {
  const trimmed = token.trim()
  if (!trimmed) return
  try {
    const next = [...readConsumedStartParams().filter((item) => item !== trimmed), trimmed].slice(-20)
    sessionStorage.setItem(CONSUMED_START_PARAMS_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  try {
    if (sessionStorage.getItem(LAUNCH_START_PARAM_KEY) === trimmed) {
      sessionStorage.removeItem(LAUNCH_START_PARAM_KEY)
    }
  } catch {
    /* ignore */
  }
  // Drop launch-only startapp from SDK initParams mirror; keep the rest intact.
  try {
    const raw = sessionStorage.getItem('__telegram__initParams')
    if (!raw) return
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return
    const record = parsed as Record<string, unknown>
    if (record.tgWebAppStartParam !== trimmed) return
    delete record.tgWebAppStartParam
    sessionStorage.setItem('__telegram__initParams', JSON.stringify(record))
  } catch {
    /* ignore */
  }
}

/**
 * Allow a fresh cold-launch startapp=devices after an in-app dismiss.
 * Does not touch signed initData / Telegram auth caches.
 */
export function reviveTelegramStartParamForFreshLaunch(token: string): void {
  const trimmed = token.trim()
  if (!trimmed) return
  if (trimmed !== 'devices' && !trimmed.startsWith('devices')) return
  try {
    const next = readConsumedStartParams().filter((item) => item !== trimmed)
    if (next.length) sessionStorage.setItem(CONSUMED_START_PARAMS_KEY, JSON.stringify(next))
    else sessionStorage.removeItem(CONSUMED_START_PARAMS_KEY)
  } catch {
    /* ignore */
  }
}

/** Dismiss devices launch so in-app Home stays on games (Suspense remount safe). */
export function dismissDevicesLaunchStartParam(): void {
  markTelegramStartParamConsumed('devices')
}

function acceptLaunchStartParam(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (isTelegramStartParamConsumed(trimmed)) return ''
  return rememberLaunchStartParam(trimmed)
}

/** Telegram launch URL / SDK storage — not proof of identity. */
export function readTelegramLaunchStartParamFromLocation(
  loc: Pick<Location, 'search' | 'hash'> = typeof window !== 'undefined'
    ? window.location
    : { search: '', hash: '' }
): string {
  try {
    const fromSearch = new URLSearchParams(loc.search || '').get('tgWebAppStartParam')
    if (fromSearch?.trim()) return fromSearch.trim()
  } catch {
    /* ignore */
  }
  try {
    const hash = loc.hash || ''
    const hashBody = hash.startsWith('#') ? hash.slice(1) : hash
    if (!hashBody) return ''
    const query = hashBody.includes('?')
      ? hashBody.slice(hashBody.indexOf('?') + 1)
      : hashBody.includes('tgWebApp')
        ? hashBody
        : ''
    if (!query) return ''
    const fromHash = new URLSearchParams(query).get('tgWebAppStartParam')
    if (fromHash?.trim()) return fromHash.trim()
  } catch {
    /* ignore */
  }
  return ''
}

function readTelegramSdkInitParamsStartParam(): string {
  try {
    const raw = sessionStorage.getItem('__telegram__initParams')
    if (!raw) return ''
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return ''
    const value = (parsed as Record<string, unknown>).tgWebAppStartParam
    return typeof value === 'string' ? value.trim() : ''
  } catch {
    return ''
  }
}

function startParamFromInitDataRaw(initDataRaw: string): string {
  if (!initDataRaw) return ''
  try {
    return new URLSearchParams(initDataRaw).get('start_param')?.trim() || ''
  } catch {
    return ''
  }
}

/**
 * One-time Mini App startapp payload for WEB Premium restore.
 * Prefer live WebApp / launch URL over stale session initData cache.
 * Do not treat this as proof of identity.
 */
export function getTelegramStartParam(): string {
  const tg = getTelegramWebApp()
  const liveInit = typeof tg?.initData === 'string' ? tg.initData : ''
  const fromLiveSigned = startParamFromInitDataRaw(liveInit)
  if (fromLiveSigned) {
    const accepted = acceptLaunchStartParam(fromLiveSigned)
    if (accepted) return accepted
  }

  const unsafe = tg?.initDataUnsafe?.start_param
  if (typeof unsafe === 'string' && unsafe.trim()) {
    const accepted = acceptLaunchStartParam(unsafe)
    if (accepted) return accepted
  }

  const fromUrl = readTelegramLaunchStartParamFromLocation()
  if (fromUrl) {
    const accepted = acceptLaunchStartParam(fromUrl)
    if (accepted) return accepted
  }

  const fromSdkStore = readTelegramSdkInitParamsStartParam()
  if (fromSdkStore) {
    const accepted = acceptLaunchStartParam(fromSdkStore)
    if (accepted) return accepted
  }

  const remembered = readRememberedLaunchStartParam()
  if (remembered) {
    const accepted = acceptLaunchStartParam(remembered)
    if (accepted) return accepted
  }

  const cachedRaw = getCachedInitData()?.initDataRaw ?? ''
  const fromCached = startParamFromInitDataRaw(cachedRaw)
  if (fromCached) {
    const accepted = acceptLaunchStartParam(fromCached)
    if (accepted) return accepted
  }

  return ''
}

/** Wait for late SDK / launch params so startapp=wl_… is not missed on cold Mini App launch. */
export async function waitForTelegramStartParam(
  timeoutMs = 3500,
  intervalMs = 60
): Promise<string> {
  const existing = getTelegramStartParam()
  if (existing) return existing
  const tg = getTelegramWebApp()
  try {
    tg?.ready?.()
  } catch {
    /* ignore */
  }
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const next = getTelegramStartParam()
    if (next) return next
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return getTelegramStartParam()
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
