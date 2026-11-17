#!/usr/bin/env node
/**
 * Focused Timeweb API path probe (DNS/TCP/TLS/TTFB, fresh vs reuse).
 * No Telegram initData / cookies / tokens.
 *
 *   node scripts/measure-api-path.mjs --label no-vpn-local
 */
import dns from 'node:dns/promises'
import https from 'node:https'
import { performance } from 'node:perf_hooks'
import { URL } from 'node:url'

const label = (() => {
  const idx = process.argv.indexOf('--label')
  return idx >= 0 ? process.argv[idx + 1] || 'local' : 'local'
})()

const API_ORIGIN = 'https://dantilor-telegram-card-game-3706.twc1.net'
const CORS_ORIGIN = 'https://dantilor.github.io'
const TIMEOUT_MS = 8_000

async function lookupHost(hostname) {
  const t0 = performance.now()
  try {
    const rows = await dns.lookup(hostname, { all: true })
    return { ok: true, ms: Math.round(performance.now() - t0), addresses: rows }
  } catch (error) {
    return { ok: false, ms: Math.round(performance.now() - t0), error: String(error.message || error) }
  }
}

function requestOnce(path, { method = 'GET', headers = {}, agent }) {
  const url = new URL(path, API_ORIGIN)
  const t0 = performance.now()
  const marks = {}

  return new Promise((resolve) => {
    let settled = false
    const finish = (row) => {
      if (settled) return
      settled = true
      resolve(row)
    }

    const req = https.request(
      {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method,
        headers,
        agent,
        servername: url.hostname,
        timeout: TIMEOUT_MS,
      },
      (res) => {
        marks.ttfbMs = Math.round(performance.now() - t0)
        let bytes = 0
        res.on('data', (chunk) => {
          bytes += chunk.length
        })
        res.on('end', () => {
          finish({
            ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 500,
            status: res.statusCode || 0,
            ms: Math.round(performance.now() - t0),
            ttfbMs: marks.ttfbMs,
            dnsMs: marks.dnsMs ?? null,
            tcpMs: marks.tcpMs ?? null,
            tlsMs: marks.tlsMs ?? null,
            bytes,
            httpVersion: res.httpVersion,
            cacheControl: res.headers['cache-control'] || null,
            via: res.headers.via || null,
            acao: res.headers['access-control-allow-origin'] || null,
            acma: res.headers['access-control-max-age'] || null,
            xCache: res.headers['x-gnh-cache'] || null,
            serverTiming: res.headers['server-timing'] || null,
          })
        })
      }
    )

    req.on('socket', (socket) => {
      socket.setMaxListeners(20)
      socket.once('lookup', () => {
        marks.dnsMs = Math.round(performance.now() - t0)
      })
      socket.once('connect', () => {
        marks.tcpMs = Math.round(performance.now() - t0)
      })
      socket.once('secureConnect', () => {
        marks.tlsMs = Math.round(performance.now() - t0)
      })
    })
    req.on('timeout', () => {
      req.destroy(new Error('timeout'))
    })
    req.on('error', (error) => {
      finish({
        ok: false,
        status: 0,
        ms: Math.round(performance.now() - t0),
        ttfbMs: marks.ttfbMs ?? null,
        dnsMs: marks.dnsMs ?? null,
        tcpMs: marks.tcpMs ?? null,
        tlsMs: marks.tlsMs ?? null,
        bytes: 0,
        error: error.message || 'request failed',
      })
    })
    req.end()
  })
}

const host = new URL(API_ORIGIN).hostname
const dnsResult = await lookupHost(host)
const jsonHeaders = { Accept: 'application/json', Origin: CORS_ORIGIN }
const preflightHeaders = {
  Origin: CORS_ORIGIN,
  'Access-Control-Request-Method': 'GET',
  'Access-Control-Request-Headers': 'x-telegram-init-data',
}

const freshAgent = new https.Agent({ keepAlive: false, maxSockets: 1 })
const reuseAgent = new https.Agent({ keepAlive: true, maxSockets: 2 })

const results = []
try {
  for (const path of ['/health', '/api/plans']) {
    results.push({
      id: `${path}:fresh`,
      connection: 'fresh',
      ...(await requestOnce(path, { headers: jsonHeaders, agent: freshAgent })),
    })
  }
  for (const path of ['/health', '/api/plans', '/api/plans']) {
    results.push({
      id: `${path}:reuse`,
      connection: 'reuse',
      ...(await requestOnce(path, { headers: jsonHeaders, agent: reuseAgent })),
    })
  }
  results.push({
    id: '/api/plans:options',
    connection: 'reuse',
    ...(await requestOnce('/api/plans', {
      method: 'OPTIONS',
      headers: preflightHeaders,
      agent: reuseAgent,
    })),
  })
  for (const path of ['/api/me', '/api/premium-status', '/api/legal/me']) {
    results.push({
      id: `${path}:reuse-noauth`,
      connection: 'reuse',
      ...(await requestOnce(path, { headers: jsonHeaders, agent: reuseAgent })),
    })
  }
} finally {
  freshAgent.destroy()
  reuseAgent.destroy()
}

console.log(
  JSON.stringify(
    {
      label,
      collectedAt: new Date().toISOString(),
      apiOrigin: API_ORIGIN,
      note: 'Run on real FR/DE/NL/EU-LTE VPN exits. /health is liveness-only. No Telegram secrets sent.',
      vpnMeasurementStatus: 'Current machine only — do not invent country latency.',
      dns: dnsResult,
      results,
    },
    null,
    2
  )
)
