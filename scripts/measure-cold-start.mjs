#!/usr/bin/env node
/**
 * Cold-start + API path comparison for GameNight Host across VPN exits.
 *
 * Measures static Mini App assets and Timeweb API DNS/TCP/TLS/TTFB with
 * both a fresh connection and a reused keep-alive socket.
 *
 * Does NOT send Telegram initData, cookies, tokens, or personal payloads.
 *
 * Usage:
 *   node scripts/measure-cold-start.mjs
 *   node scripts/measure-cold-start.mjs --label vpn-fr
 *   node scripts/measure-cold-start.mjs --label vpn-de --api-only
 */
import dns from 'node:dns/promises'
import http from 'node:http'
import https from 'node:https'
import { performance } from 'node:perf_hooks'
import { URL } from 'node:url'

const label = flagValue('--label') || 'local'
const apiOnly = process.argv.includes('--api-only')
const API_ORIGIN = 'https://dantilor-telegram-card-game-3706.twc1.net'
const MINIAPP_ORIGIN = 'https://dantilor.github.io'
const MINIAPP_BASE = `${MINIAPP_ORIGIN}/telegram-card-game/`
const CORS_ORIGIN = MINIAPP_ORIGIN
const REQUEST_TIMEOUT_MS = 8_000

function flagValue(name) {
  const idx = process.argv.indexOf(name)
  if (idx === -1) return null
  return process.argv[idx + 1] || null
}

function withTimeout(promise, ms, label) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({
        ok: false,
        status: 0,
        ms,
        ttfbMs: null,
        dnsMs: null,
        tcpMs: null,
        tlsMs: null,
        bytes: 0,
        error: `timeout after ${ms}ms (${label})`,
      })
    }, ms)
    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch((error) => {
        clearTimeout(timer)
        resolve({
          ok: false,
          status: 0,
          ms,
          ttfbMs: null,
          dnsMs: null,
          tcpMs: null,
          tlsMs: null,
          bytes: 0,
          error: error instanceof Error ? error.message : 'request failed',
        })
      })
  })
}

async function measureFetch(id, url, headers = {}) {
  const started = performance.now()
  try {
    const response = await fetch(url, { headers, redirect: 'follow' })
    const buffer = await response.arrayBuffer()
    return {
      id,
      url: stripQuery(url),
      ok: response.ok,
      status: response.status,
      ms: Math.round(performance.now() - started),
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
      url: stripQuery(url),
      ok: false,
      status: 0,
      ms: Math.round(performance.now() - started),
      bytes: 0,
      error: error instanceof Error ? error.message : 'fetch failed',
    }
  }
}

function stripQuery(url) {
  return url.replace(/\?.*$/, '')
}

async function dnsLookup(hostname) {
  const started = performance.now()
  try {
    const records = await dns.lookup(hostname, { all: true })
    return {
      ok: true,
      ms: Math.round(performance.now() - started),
      addresses: records.map((row) => ({ address: row.address, family: row.family })),
    }
  } catch (error) {
    return {
      ok: false,
      ms: Math.round(performance.now() - started),
      error: error instanceof Error ? error.message : 'dns failed',
    }
  }
}

function timedHttpsRequest(urlString, { method = 'GET', headers = {}, agent } = {}) {
  const url = new URL(urlString)
  const lib = url.protocol === 'http:' ? http : https
  const started = performance.now()
  const marks = {}

  return new Promise((resolve) => {
    const req = lib.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === 'http:' ? 80 : 443),
        path: `${url.pathname}${url.search}`,
        method,
        headers,
        agent,
        servername: url.hostname,
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res) => {
        marks.ttfbMs = Math.round(performance.now() - started)
        const chunks = []
        res.on('data', (chunk) => chunks.push(chunk))
        res.on('end', () => {
          const buffer = Buffer.concat(chunks)
          resolve({
            ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 400,
            status: res.statusCode || 0,
            ms: Math.round(performance.now() - started),
            ttfbMs: marks.ttfbMs,
            dnsMs: marks.dnsMs ?? null,
            tcpMs: marks.tcpMs ?? null,
            tlsMs: marks.tlsMs ?? null,
            bytes: buffer.length,
            httpVersion: res.httpVersion,
            cacheControl: res.headers['cache-control'] || null,
            contentEncoding: res.headers['content-encoding'] || null,
            via: res.headers.via || null,
            acao: res.headers['access-control-allow-origin'] || null,
            acam: res.headers['access-control-allow-methods'] || null,
            acah: res.headers['access-control-allow-headers'] || null,
            acma: res.headers['access-control-max-age'] || null,
            xCache: res.headers['x-gnh-cache'] || null,
            serverTiming: res.headers['server-timing'] || null,
          })
        })
      }
    )

    req.on('socket', (socket) => {
      socket.setMaxListeners(20)
      if (!socket.connecting && socket.authorized !== undefined) {
        // Reused TLS socket — handshake already done.
        marks.reused = true
      }
      socket.once('lookup', () => {
        marks.dnsMs = Math.round(performance.now() - started)
      })
      socket.once('connect', () => {
        marks.tcpMs = Math.round(performance.now() - started)
      })
      socket.once('secureConnect', () => {
        marks.tlsMs = Math.round(performance.now() - started)
      })
    })

    req.on('timeout', () => {
      req.destroy(new Error('timeout'))
    })
    req.on('error', (error) => {
      resolve({
        ok: false,
        status: 0,
        ms: Math.round(performance.now() - started),
        ttfbMs: null,
        dnsMs: marks.dnsMs ?? null,
        tcpMs: marks.tcpMs ?? null,
        tlsMs: marks.tlsMs ?? null,
        bytes: 0,
        error: error instanceof Error ? error.message : 'request failed',
      })
    })
    req.end()
  })
}

async function measureApiPath(id, path, { method = 'GET', headers = {}, reuseAgent = null } = {}) {
  const url = `${API_ORIGIN}${path}`
  if (reuseAgent) {
    const reused = await withTimeout(
      timedHttpsRequest(url, { method, headers, agent: reuseAgent }),
      REQUEST_TIMEOUT_MS + 500,
      id
    )
    return { id: `${id}:reuse`, path, method, connection: 'reuse', ...reused }
  }

  const freshAgent = new https.Agent({ keepAlive: false, maxSockets: 1 })
  try {
    const fresh = await withTimeout(
      timedHttpsRequest(url, { method, headers, agent: freshAgent }),
      REQUEST_TIMEOUT_MS + 500,
      id
    )
    return { id: `${id}:fresh`, path, method, connection: 'fresh', ...fresh }
  } finally {
    freshAgent.destroy()
  }
}

const staticTargets = [
  { id: 'miniapp-html', url: MINIAPP_BASE },
  { id: 'miniapp-entry-js', url: null, discoverFrom: 'miniapp-html', pattern: /(?:\.\/|\/telegram-card-game\/|\/)?assets\/index-[^"'\\\s]+\.js/ },
  { id: 'miniapp-css', url: null, discoverFrom: 'miniapp-html', pattern: /(?:\.\/|\/telegram-card-game\/|\/)?assets\/index-[^"'\\\s]+\.css/ },
  { id: 'telegram-sdk-same-origin', url: `${MINIAPP_BASE}telegram-web-app.js` },
  { id: 'google-fonts-css-legacy', url: 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Unbounded:wght@500;600;700&display=swap' },
]

const discovered = new Map()
const staticResults = []

if (!apiOnly) {
  for (const target of staticTargets) {
    let url = target.url
    if (!url && target.discoverFrom && target.pattern) {
      const parent = staticResults.find((row) => row.id === target.discoverFrom)
      const match = parent?.bodyText?.match(target.pattern)
      if (!match) {
        staticResults.push({ id: target.id, ok: false, status: 0, ms: 0, bytes: 0, error: 'asset not found in html' })
        continue
      }
      url = new URL(match[0], MINIAPP_BASE).href
      discovered.set(target.id, url)
    }
    const row = await measureFetch(target.id, url)
    delete row.bodyText
    staticResults.push(row)
  }
}

const apiHost = new URL(API_ORIGIN).hostname
const dnsResult = await dnsLookup(apiHost)

const corsGetHeaders = {
  Accept: 'application/json',
  Origin: CORS_ORIGIN,
}
const corsPreflightHeaders = {
  Origin: CORS_ORIGIN,
  'Access-Control-Request-Method': 'GET',
  'Access-Control-Request-Headers': 'x-telegram-init-data',
}

const keepAliveAgent = new https.Agent({ keepAlive: true, maxSockets: 4 })
const apiResults = []

try {
  // Fresh TLS samples (expensive on FR/DE/NL VPN) — keep the set small.
  for (const [id, path] of [
    ['api-health', '/health'],
    ['api-plans', '/api/plans'],
  ]) {
    apiResults.push(await measureApiPath(id, path, { headers: corsGetHeaders }))
  }

  // Warm / reused keep-alive samples (no secrets)
  for (const [id, path] of [
    ['api-health', '/health'],
    ['api-plans', '/api/plans'],
    ['api-plans', '/api/plans'],
    ['api-me-noauth', '/api/me'],
    ['api-premium-status-noauth', '/api/premium-status'],
    ['api-legal-me-noauth', '/api/legal/me'],
  ]) {
    apiResults.push(await measureApiPath(id, path, { headers: corsGetHeaders, reuseAgent: keepAliveAgent }))
  }

  apiResults.push(
    await measureApiPath('api-plans-options', '/api/plans', {
      method: 'OPTIONS',
      headers: corsPreflightHeaders,
      reuseAgent: keepAliveAgent,
    })
  )

  // Room routers: surface probe only (no writes / no participant payloads).
  for (const [id, path] of [
    ['api-sled', '/api/sled'],
    ['api-mafia-shadows', '/api/games/mafia-shadows'],
    ['api-doubles', '/api/games/doubles'],
    ['api-infected', '/api/games/infected'],
  ]) {
    apiResults.push(await measureApiPath(id, path, { headers: corsGetHeaders, reuseAgent: keepAliveAgent }))
  }
} finally {
  keepAliveAgent.destroy()
}

const report = {
  label,
  collectedAt: new Date().toISOString(),
  note:
    'Compare identical --label values across real VPN exits (fr/de/nl/eu-lte/no-vpn). No Telegram credentials are sent. /health is liveness-only and does not prove PostgreSQL.',
  vpnMeasurementStatus:
    'This run reflects the current machine network only. FR/DE/NL/EU-LTE require repeating the script on those exits; do not invent country latency.',
  apiOrigin: API_ORIGIN,
  dns: dnsResult,
  staticResults,
  apiResults,
  discovered: Object.fromEntries(discovered),
}

console.log(JSON.stringify(report, null, 2))
