#!/usr/bin/env node
/**
 * Offline / VPN comparison helper for GameNight Host cold start.
 * Measures DNS-ish wait, TTFB, body size for key production URLs.
 * Does not send Telegram initData or credentials.
 *
 * Usage:
 *   node scripts/measure-cold-start.mjs
 *   node scripts/measure-cold-start.mjs --label "vpn-fr"
 */
import { performance } from 'node:perf_hooks'

const label = process.argv.includes('--label')
  ? process.argv[process.argv.indexOf('--label') + 1] || 'local'
  : 'local'

const TARGETS = [
  { id: 'miniapp-html', url: 'https://dantilor.github.io/telegram-card-game/' },
  { id: 'miniapp-entry-js', url: null, discoverFrom: 'miniapp-html', pattern: /(?:\.\/|\/telegram-card-game\/|\/)?assets\/index-[^"'\\\s]+\.js/ },
  { id: 'miniapp-css', url: null, discoverFrom: 'miniapp-html', pattern: /(?:\.\/|\/telegram-card-game\/|\/)?assets\/index-[^"'\\\s]+\.css/ },
  { id: 'telegram-sdk-cdn', url: 'https://telegram.org/js/telegram-web-app.js' },
  { id: 'telegram-sdk-same-origin', url: 'https://dantilor.github.io/telegram-card-game/telegram-web-app.js' },
  { id: 'google-fonts-css-legacy', url: 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Unbounded:wght@500;600;700&display=swap' },
  { id: 'api-health', url: 'https://dantilor-telegram-card-game-3706.twc1.net/health' },
  { id: 'api-plans', url: 'https://dantilor-telegram-card-game-3706.twc1.net/api/plans', headers: { Accept: 'application/json', Origin: 'https://dantilor.github.io' } },
]

async function measure(id, url, headers = {}) {
  const started = performance.now()
  try {
    const response = await fetch(url, { headers, redirect: 'follow' })
    const buffer = await response.arrayBuffer()
    const ms = Math.round(performance.now() - started)
    return {
      id,
      url: url.replace(/\?.*$/, ''),
      ok: response.ok,
      status: response.status,
      ms,
      bytes: buffer.byteLength,
      encoding: response.headers.get('content-encoding'),
      cacheControl: response.headers.get('cache-control'),
      server: response.headers.get('server'),
      via: response.headers.get('via'),
      bodyText: id === 'miniapp-html' ? new TextDecoder().decode(buffer) : undefined,
    }
  } catch (error) {
    return {
      id,
      url: url.replace(/\?.*$/, ''),
      ok: false,
      status: 0,
      ms: Math.round(performance.now() - started),
      bytes: 0,
      error: error instanceof Error ? error.message : 'fetch failed',
    }
  }
}

const discovered = new Map()
const results = []

for (const target of TARGETS) {
  let url = target.url
  if (!url && target.discoverFrom && target.pattern) {
    const parent = results.find((row) => row.id === target.discoverFrom)
    const match = parent?.bodyText?.match(target.pattern)
    if (!match) {
      results.push({ id: target.id, ok: false, status: 0, ms: 0, bytes: 0, error: 'asset not found in html' })
      continue
    }
    url = new URL(match[0], 'https://dantilor.github.io/telegram-card-game/').href
    discovered.set(target.id, url)
  }
  const row = await measure(target.id, url, target.headers)
  delete row.bodyText
  results.push(row)
}

const report = {
  label,
  collectedAt: new Date().toISOString(),
  note: 'Compare the same label across VPN exits. No Telegram credentials are sent.',
  results,
  discovered: Object.fromEntries(discovered),
}

console.log(JSON.stringify(report, null, 2))
