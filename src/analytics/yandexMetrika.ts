/**
 * Async Yandex Metrika loader for WEB.
 * Script and hits run only after consent. No Webvisor / form recording.
 * Failures (blocked network, adblock) never throw into the app.
 */

import { METRIKA_COUNTER_ID, METRIKA_SAFE_ID, METRIKA_SCRIPT_URL, type MetrikaGoal } from './metrikaConfig'
import { isMetrikaConsentGranted } from './metrikaConsent'
import { metrikaAbsoluteUrl, normalizeMetrikaPath } from './metrikaPath'

type YmFunction = (counterId: number, method: string, ...args: unknown[]) => void

type YmStub = YmFunction & {
  a?: unknown[]
  l?: number
}

declare global {
  interface Window {
    ym?: YmStub
  }
}

let scriptPromise: Promise<void> | null = null
let initialized = false
let stopped = false
let lastHitKey: string | null = null
let firstHitDone = false

function ensureYmStub(): YmStub {
  if (typeof window.ym === 'function') return window.ym
  const stub: YmStub = function ym(...args: unknown[]) {
    ;(stub.a = stub.a || []).push(args)
  }
  stub.l = Date.now()
  window.ym = stub
  return stub
}

function callYm(method: string, ...args: unknown[]): void {
  if (stopped || !isMetrikaConsentGranted()) return
  try {
    const ym = ensureYmStub()
    ym(METRIKA_COUNTER_ID, method, ...args)
  } catch {
    /* never break UX */
  }
}

export function isMetrikaInitialized(): boolean {
  return initialized && !stopped
}

export function loadYandexMetrika(): Promise<void> {
  if (!isMetrikaConsentGranted()) return Promise.resolve()
  if (stopped) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<void>((resolve) => {
    try {
      ensureYmStub()
      const existing = document.querySelector<HTMLScriptElement>(`script[data-gnh-metrika="1"]`)
      if (existing) {
        resolve()
        return
      }
      const script = document.createElement('script')
      script.async = true
      script.src = METRIKA_SCRIPT_URL
      script.dataset.gnhMetrika = '1'
      script.onload = () => resolve()
      script.onerror = () => {
        // Metrika unreachable — keep the app working; clear promise so a later grant can retry.
        scriptPromise = null
        resolve()
      }
      const first = document.getElementsByTagName('script')[0]
      if (first?.parentNode) first.parentNode.insertBefore(script, first)
      else document.head.appendChild(script)
    } catch {
      scriptPromise = null
      resolve()
    }
  })
  return scriptPromise
}

export async function enableYandexMetrika(): Promise<void> {
  if (!isMetrikaConsentGranted()) return
  stopped = false
  await loadYandexMetrika()
  if (stopped || !isMetrikaConsentGranted()) return
  if (!initialized) {
    callYm('init', {
      defer: true,
      clickmap: true,
      trackLinks: true,
      accurateTrackBounce: true,
      webvisor: false,
      ecommerce: false,
      triggerEvent: true,
    })
    initialized = true
  }
}

/**
 * SPA pageview. Call on every meaningful route change after enable.
 * Skips duplicate consecutive hits. With defer:true the first hit is also manual.
 */
export function hitYandexMetrika(pathname: string, title?: string, refererPath?: string): void {
  if (!initialized || stopped || !isMetrikaConsentGranted()) return
  const path = normalizeMetrikaPath(pathname)
  const key = path
  if (lastHitKey === key && firstHitDone) return
  const url = metrikaAbsoluteUrl(path)
  const options: Record<string, unknown> = {}
  if (title && title.trim()) options.title = title.trim().slice(0, 200)
  if (refererPath) options.referer = metrikaAbsoluteUrl(refererPath)
  callYm('hit', url, options)
  lastHitKey = key
  firstHitDone = true
}

function scrubGoalParams(params?: Record<string, string>): Record<string, string> | undefined {
  if (!params) return undefined
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    if (key !== 'gameId' && key !== 'planId') continue
    if (typeof value !== 'string' || !METRIKA_SAFE_ID.test(value)) continue
    out[key] = value
  }
  return Object.keys(out).length ? out : undefined
}

export function reachYandexGoal(goal: MetrikaGoal, params?: Record<string, string>): void {
  if (!initialized || stopped || !isMetrikaConsentGranted()) return
  const clean = scrubGoalParams(params)
  if (clean) callYm('reachGoal', goal, clean)
  else callYm('reachGoal', goal)
}

/** Stop sending. Does not claim to erase Yandex-side cookies (user must clear site data). */
export function disableYandexMetrika(): void {
  stopped = true
  initialized = false
  firstHitDone = false
  lastHitKey = null
  scriptPromise = null
  try {
    document.querySelectorAll('script[data-gnh-metrika="1"]').forEach((node) => node.remove())
  } catch {
    /* ignore */
  }
  // Leave window.ym stub in place so late callbacks no-op safely via stopped flag.
}

/** Test helper */
export function resetYandexMetrikaForTests(): void {
  disableYandexMetrika()
  stopped = false
  try {
    delete window.ym
  } catch {
    /* ignore */
  }
}