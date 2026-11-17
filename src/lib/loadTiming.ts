/**
 * Opt-in cold-start timing for VPN / WebView diagnosis.
 *
 * Enable: ?gnh_perf=1  or  localStorage.gnh_perf = "1"
 * Read:   window.__GNH_PERF__
 *
 * Never logs initData, tokens, cookies, or personal fields.
 */

export type LoadTimingBucket = 'network_wait' | 'resource_download' | 'js_parse' | 'api_wait' | 'other'

export type LoadTimingEntry = {
  name: string
  bucket: LoadTimingBucket
  startMs: number
  durationMs: number
  transferSize: number | null
  encodedBodySize: number | null
  initiatorType: string | null
}

export type LoadTimingReport = {
  enabled: boolean
  collectedAt: string
  page: {
    origin: string
    path: string
    // query is omitted — may contain Telegram start_param / secrets
  }
  navigation: {
    dnsMs: number | null
    tcpMs: number | null
    tlsMs: number | null
    ttfbMs: number | null
    responseMs: number | null
    domContentLoadedMs: number | null
    loadEventMs: number | null
    transferSize: number | null
    encodedBodySize: number | null
    type: string | null
  }
  marks: {
    firstPaintMs: number | null
    firstContentfulPaintMs: number | null
    reactRootMs: number | null
    homeVisibleMs: number | null
  }
  resources: LoadTimingEntry[]
  totals: {
    networkWaitMs: number
    resourceDownloadMs: number
    jsParseApproxMs: number
    apiWaitMs: number
    transferredBytes: number
  }
  hosts: Array<{ host: string; count: number; totalDurationMs: number; totalBytes: number }>
}

declare global {
  interface Window {
    __GNH_PERF__?: LoadTimingReport
    __GNH_PERF_MARKS__?: Record<string, number>
  }
}

const SECRETISH = /initData|auth_date|hash=|password|token|cookie|authorization|telegram_id|phone|email/i

export function isLoadTimingEnabled(search = typeof location !== 'undefined' ? location.search : ''): boolean {
  try {
    if (new URLSearchParams(search).get('gnh_perf') === '1') return true
    if (typeof localStorage !== 'undefined' && localStorage.getItem('gnh_perf') === '1') return true
  } catch {
    // ignore storage / URL errors
  }
  return false
}

export function markLoadTiming(name: string): void {
  if (typeof performance === 'undefined') return
  try {
    performance.mark(`gnh:${name}`)
    if (typeof window !== 'undefined') {
      window.__GNH_PERF_MARKS__ = window.__GNH_PERF_MARKS__ ?? {}
      window.__GNH_PERF_MARKS__[name] = Math.round(performance.now())
    }
  } catch {
    // ignore
  }
}

function navTiming(): LoadTimingReport['navigation'] {
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  if (!nav) {
    return {
      dnsMs: null,
      tcpMs: null,
      tlsMs: null,
      ttfbMs: null,
      responseMs: null,
      domContentLoadedMs: null,
      loadEventMs: null,
      transferSize: null,
      encodedBodySize: null,
      type: null,
    }
  }
  const dns = Math.max(0, nav.domainLookupEnd - nav.domainLookupStart)
  const tcp = Math.max(0, nav.connectEnd - nav.connectStart)
  const tls =
    nav.secureConnectionStart > 0 ? Math.max(0, nav.connectEnd - nav.secureConnectionStart) : null
  return {
    dnsMs: round(dns),
    tcpMs: round(tcp),
    tlsMs: tls === null ? null : round(tls),
    ttfbMs: round(Math.max(0, nav.responseStart - nav.requestStart)),
    responseMs: round(Math.max(0, nav.responseEnd - nav.responseStart)),
    domContentLoadedMs: round(nav.domContentLoadedEventEnd),
    loadEventMs: round(nav.loadEventEnd),
    transferSize: numberOrNull(nav.transferSize),
    encodedBodySize: numberOrNull(nav.encodedBodySize),
    type: nav.type || null,
  }
}

function paintMs(name: string): number | null {
  const entry = performance.getEntriesByName(name)[0]
  return entry ? round(entry.startTime) : null
}

function markMs(name: string): number | null {
  if (typeof window !== 'undefined') {
    const fromWindow = window.__GNH_PERF_MARKS__?.[name]
    if (typeof fromWindow === 'number') return fromWindow
  }
  if (typeof performance === 'undefined') return null
  const entry = performance.getEntriesByName(`gnh:${name}`)[0]
  return entry ? round(entry.startTime) : null
}

function classify(name: string, initiatorType: string): LoadTimingBucket {
  const lower = name.toLowerCase()
  if (/\/api\/|twc1\.net/i.test(lower)) return 'api_wait'
  if (initiatorType === 'script' || /\.m?js(\?|$)/i.test(lower) || /telegram-web-app/i.test(lower)) {
    return 'js_parse'
  }
  if (
    initiatorType === 'css' ||
    initiatorType === 'link' ||
    initiatorType === 'img' ||
    initiatorType === 'font' ||
    /\.(css|woff2?|ttf|png|jpe?g|webp|avif|svg)(\?|$)/i.test(lower)
  ) {
    return 'resource_download'
  }
  if (initiatorType === 'xmlhttprequest' || initiatorType === 'fetch') return 'api_wait'
  return 'other'
}

function pageBase(): string {
  if (typeof location !== 'undefined' && location.href) return location.href
  return 'https://local.test/'
}

function safeName(raw: string): string {
  if (SECRETISH.test(raw)) return '[redacted-url]'
  try {
    const url = new URL(raw, pageBase())
    // Drop query/hash — startapp params can carry user-ish data.
    return `${url.origin}${url.pathname}`
  } catch {
    return raw.slice(0, 120)
  }
}

function round(n: number): number {
  return Math.round(n)
}

function numberOrNull(n: number | undefined): number | null {
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

function resourceEntries(): LoadTimingEntry[] {
  return performance.getEntriesByType('resource').map((entry) => {
    const res = entry as PerformanceResourceTiming
    const name = safeName(res.name)
    return {
      name,
      bucket: classify(name, res.initiatorType || ''),
      startMs: round(res.startTime),
      durationMs: round(res.duration),
      transferSize: numberOrNull(res.transferSize),
      encodedBodySize: numberOrNull(res.encodedBodySize),
      initiatorType: res.initiatorType || null,
    }
  })
}

function hostRollup(resources: LoadTimingEntry[]): LoadTimingReport['hosts'] {
  const map = new Map<string, { count: number; totalDurationMs: number; totalBytes: number }>()
  for (const item of resources) {
    let host = 'relative'
    try {
      host = new URL(item.name, pageBase()).host || 'relative'
    } catch {
      host = 'unknown'
    }
    const prev = map.get(host) ?? { count: 0, totalDurationMs: 0, totalBytes: 0 }
    prev.count += 1
    prev.totalDurationMs += item.durationMs
    prev.totalBytes += item.transferSize ?? item.encodedBodySize ?? 0
    map.set(host, prev)
  }
  return [...map.entries()]
    .map(([host, value]) => ({ host, ...value, totalDurationMs: round(value.totalDurationMs) }))
    .sort((a, b) => b.totalDurationMs - a.totalDurationMs)
}

export function buildLoadTimingReport(): LoadTimingReport {
  const emptyNav: LoadTimingReport['navigation'] = {
    dnsMs: null,
    tcpMs: null,
    tlsMs: null,
    ttfbMs: null,
    responseMs: null,
    domContentLoadedMs: null,
    loadEventMs: null,
    transferSize: null,
    encodedBodySize: null,
    type: null,
  }
  if (typeof performance === 'undefined') {
    return {
      enabled: true,
      collectedAt: new Date().toISOString(),
      page: { origin: '', path: '' },
      navigation: emptyNav,
      marks: {
        firstPaintMs: null,
        firstContentfulPaintMs: null,
        reactRootMs: null,
        homeVisibleMs: null,
      },
      resources: [],
      totals: {
        networkWaitMs: 0,
        resourceDownloadMs: 0,
        jsParseApproxMs: 0,
        apiWaitMs: 0,
        transferredBytes: 0,
      },
      hosts: [],
    }
  }

  const resources = resourceEntries()
  const totals = {
    networkWaitMs: 0,
    resourceDownloadMs: 0,
    jsParseApproxMs: 0,
    apiWaitMs: 0,
    transferredBytes: 0,
  }
  const nav = navTiming()
  totals.networkWaitMs = (nav.dnsMs ?? 0) + (nav.tcpMs ?? 0) + (nav.tlsMs ?? 0) + (nav.ttfbMs ?? 0)
  for (const item of resources) {
    totals.transferredBytes += item.transferSize ?? item.encodedBodySize ?? 0
    if (item.bucket === 'resource_download') totals.resourceDownloadMs += item.durationMs
    if (item.bucket === 'js_parse') totals.jsParseApproxMs += item.durationMs
    if (item.bucket === 'api_wait') totals.apiWaitMs += item.durationMs
  }

  return {
    enabled: true,
    collectedAt: new Date().toISOString(),
    page: {
      origin: typeof location !== 'undefined' ? location.origin : '',
      path: typeof location !== 'undefined' ? location.pathname : '',
    },
    navigation: nav,
    marks: {
      firstPaintMs: paintMs('first-paint'),
      firstContentfulPaintMs: paintMs('first-contentful-paint'),
      reactRootMs: markMs('react-root'),
      homeVisibleMs: markMs('home-visible'),
    },
    resources,
    totals: {
      networkWaitMs: round(totals.networkWaitMs),
      resourceDownloadMs: round(totals.resourceDownloadMs),
      jsParseApproxMs: round(totals.jsParseApproxMs),
      apiWaitMs: round(totals.apiWaitMs),
      transferredBytes: totals.transferredBytes,
    },
    hosts: hostRollup(resources),
  }
}

export function publishLoadTimingReport(delayMs = 2500): () => void {
  if (typeof window === 'undefined' || !isLoadTimingEnabled()) {
    return () => undefined
  }
  markLoadTiming('react-root')
  const timer = window.setTimeout(() => {
    try {
      const report = buildLoadTimingReport()
      window.__GNH_PERF__ = report
      // Structured, copy-paste friendly, no secrets by construction.
      console.info('[GNH_PERF]', JSON.stringify(report))
    } catch (error) {
      console.warn('[GNH_PERF] failed', error instanceof Error ? error.message : 'error')
    }
  }, delayMs)
  return () => window.clearTimeout(timer)
}
