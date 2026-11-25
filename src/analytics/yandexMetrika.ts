/**
 * Async Yandex Metrika loader for WEB.
 * Script and hits run only after consent. No Webvisor / form recording / clickmap / trackLinks
 * until URL sensitivity audit is complete (tag.js otherwise may see location.href with secrets).
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
/** True once tag.js was requested or init ran in this page (something to tear down). */
let everActive = false
/** After a hard stop (destruct + silent ym) the tag cannot be revived in the same page. */
let hardStopped = false

const SILENT_FLAG = '__gnhMetrikaSilent'

function disableCounterFlagKey(): string {
  return `disableYaCounter${METRIKA_COUNTER_ID}`
}

function setOfficialOptOut(disabled: boolean): void {
  try {
    ;(window as unknown as Record<string, unknown>)[disableCounterFlagKey()] = disabled
  } catch {
    /* ignore */
  }
}

function ensureYmStub(): YmStub {
  // Our own no-op (installed by a hard stop) must never be reused as the tag queue.
  if (typeof window.ym === 'function' && !(window.ym as unknown as Record<string, unknown>)[SILENT_FLAG]) {
    return window.ym
  }
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
        everActive = true
        resolve()
        return
      }
      everActive = true
      const script = document.createElement('script')
      script.async = true
      script.src = METRIKA_SCRIPT_URL
      script.dataset.gnhMetrika = '1'
      script.onload = () => resolve()
      script.onerror = () => {
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

/**
 * The tag's init request carries location.href as page-url (nohit=1) before any manual hit can
 * override it, so it must never start on a URL with a query/hash (online room codes, tokens,
 * email-confirm links, payment return). It starts on the next clean URL instead.
 */
export function isMetrikaUrlClean(): boolean {
  try {
    return !window.location.search && !window.location.hash
  } catch {
    return false
  }
}

export async function enableYandexMetrika(): Promise<void> {
  if (!isMetrikaConsentGranted()) return
  if (hardStopped) {
    // The tag was destroyed in this page (revoked in another tab). Consent is stored; a fresh
    // page load starts it cleanly instead of reviving a destroyed counter.
    try {
      window.setTimeout(() => window.location.reload(), 0)
    } catch {
      /* ignore */
    }
    return
  }
  if (!initialized && !isMetrikaUrlClean()) return
  stopped = false
  setOfficialOptOut(false)
  await loadYandexMetrika()
  if (stopped || !isMetrikaConsentGranted()) return
  if (!initialized) {
    callYm('init', {
      defer: true,
      // Off until URL/PII audit: built-in handlers can see raw location.href / link hrefs.
      clickmap: false,
      trackLinks: false,
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

export function reachYandexGoal(goal: MetrikaGoal, params?: Record<string, string>): boolean {
  if (!initialized || stopped || !isMetrikaConsentGranted()) return false
  // Goal hits use the counter's last hit URL as page-ref. Without a prior sanitized hit they
  // would fall back to the real location.href, so always send a scrubbed hit first.
  if (!firstHitDone) hitYandexMetrika(window.location.pathname, document.title)
  if (!firstHitDone) return false
  const clean = scrubGoalParams(params)
  if (clean) callYm('reachGoal', goal, clean)
  else callYm('reachGoal', goal)
  return true
}

export type DisableMetrikaOptions = {
  /** After revoke, reload so in-memory tag handlers cannot keep sending. */
  reload?: boolean
}

/** Delete Metrika-owned cookies and storage keys (_ym*) for this host and its parent domains. */
export function purgeMetrikaStorage(): void {
  try {
    const names = document.cookie
      .split(';')
      .map((part) => part.split('=')[0]?.trim() ?? '')
      .filter((name) => name.startsWith('_ym'))
    if (names.length) {
      const host = window.location.hostname
      const parts = host.split('.')
      const domains: Array<string | null> = [null, host]
      for (let i = 1; i < parts.length - 1; i += 1) domains.push(`.${parts.slice(i).join('.')}`)
      for (const name of names) {
        for (const domain of domains) {
          document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${domain ? `; Domain=${domain}` : ''}`
        }
      }
    }
  } catch {
    /* ignore */
  }
  for (const store of ['localStorage', 'sessionStorage'] as const) {
    try {
      const area = window[store]
      Object.keys(area)
        .filter((key) => key.startsWith('_ym'))
        .forEach((key) => area.removeItem(key))
    } catch {
      /* ignore */
    }
  }
}

/**
 * Stop tracking. If the tag was ever loaded in this page: official opt-out flag, ym('destruct'),
 * replace ym with a no-op, remove the script and (optionally) reload. If it never ran there is
 * nothing to tear down, so window.ym is left alone and the page is never reloaded.
 * Metrika-owned cookies and storage are removed; data already sent to Yandex is not erased.
 */
export function disableYandexMetrika(options?: DisableMetrikaOptions): void {
  const wasActive =
    everActive || initialized || !!document.querySelector('script[data-gnh-metrika="1"]')

  stopped = true
  initialized = false
  firstHitDone = false
  lastHitKey = null
  scriptPromise = null
  everActive = false

  setOfficialOptOut(true)

  if (wasActive) {
    hardStopped = true
    try {
      const ym = window.ym
      if (typeof ym === 'function') {
        ym(METRIKA_COUNTER_ID, 'destruct')
      }
    } catch {
      /* ignore */
    }

    try {
      const silent: YmStub = function ym() {
        /* swallow post-revoke calls */
      }
      silent.a = []
      silent.l = Date.now()
      ;(silent as unknown as Record<string, unknown>)[SILENT_FLAG] = true
      window.ym = silent
    } catch {
      /* ignore */
    }

    try {
      document.querySelectorAll('script[data-gnh-metrika="1"]').forEach((node) => node.remove())
    } catch {
      /* ignore */
    }
  }

  if (wasActive) purgeMetrikaStorage()

  if (options?.reload && wasActive) {
    try {
      window.setTimeout(() => {
        window.location.reload()
      }, 0)
    } catch {
      /* ignore */
    }
  }
}

/** Test helper */
export function resetYandexMetrikaForTests(): void {
  disableYandexMetrika()
  stopped = false
  hardStopped = false
  everActive = false
  setOfficialOptOut(false)
  try {
    delete window.ym
  } catch {
    /* ignore */
  }
}