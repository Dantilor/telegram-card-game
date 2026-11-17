#!/usr/bin/env node
/**
 * Reproducible browser cold-start (not Telegram WebView).
 * Serves a built dist folder, disables cache, collects Navigation/Paint marks.
 *
 * Usage:
 *   node scripts/measure-browser-cold.mjs --dir dist --label after
 *   node scripts/measure-browser-cold.mjs --dir dist-before --label before
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const dir = path.resolve(flagValue('--dir') || 'dist')
const label = flagValue('--label') || path.basename(dir)
const basePath = '/telegram-card-game/'
const PORT = Number(flagValue('--port') || 0)

function flagValue(name) {
  const idx = process.argv.indexOf(name)
  if (idx === -1) return null
  return process.argv[idx + 1] || null
}

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8'
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8'
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8'
  if (filePath.endsWith('.woff2')) return 'font/woff2'
  if (filePath.endsWith('.woff')) return 'font/woff'
  if (filePath.endsWith('.webp')) return 'image/webp'
  if (filePath.endsWith('.avif')) return 'image/avif'
  if (filePath.endsWith('.svg')) return 'image/svg+xml'
  if (filePath.endsWith('.png')) return 'image/png'
  return 'application/octet-stream'
}

function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://127.0.0.1`)
    let pathname = decodeURIComponent(url.pathname)
    if (pathname.startsWith(basePath)) pathname = pathname.slice(basePath.length - 1)
    if (pathname === '/' || pathname === '') pathname = '/index.html'
    const filePath = path.join(dir, pathname.replace(/^\//, ''))
    if (!filePath.startsWith(dir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404)
      res.end('not found')
      return
    }
    res.writeHead(200, {
      'Content-Type': contentType(filePath),
      'Cache-Control': 'no-store',
    })
    fs.createReadStream(filePath).pipe(res)
  })
  return new Promise((resolve) => {
    server.listen(PORT, '127.0.0.1', () => {
      const { port } = server.address()
      resolve({ server, port })
    })
  })
}

async function measureOnce(page, url) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(2800)
  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0]
    const resources = performance.getEntriesByType('resource')
    const paint = Object.fromEntries(
      performance.getEntriesByType('paint').map((e) => [e.name, Math.round(e.startTime)]),
    )
    const lcpEntries = performance.getEntriesByType('largest-contentful-paint')
    const lcp = lcpEntries.length ? Math.round(lcpEntries[lcpEntries.length - 1].startTime) : null
    const marks = window.__GNH_PERF_MARKS__ || {}
    const initialScript = resources.filter((r) => /\/assets\/index-.*\.js$/.test(r.name))
    const initialCss = resources.filter((r) => /\/assets\/index-.*\.css$/.test(r.name))
    const transferred = resources.reduce((s, r) => s + (r.transferSize || 0), 0)
    const beforeHome = resources.filter((r) => {
      const home = marks['home-visible']
      return typeof home === 'number' ? r.responseEnd <= home : r.startTime < 2500
    })
    return {
      navigation: nav
        ? {
            dnsMs: Math.round(nav.domainLookupEnd - nav.domainLookupStart),
            tcpMs: Math.round(nav.connectEnd - nav.connectStart),
            tlsMs: nav.secureConnectionStart > 0 ? Math.round(nav.connectEnd - nav.secureConnectionStart) : null,
            ttfbMs: Math.round(nav.responseStart - nav.requestStart),
            responseMs: Math.round(nav.responseEnd - nav.responseStart),
            domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd),
            loadEventMs: Math.round(nav.loadEventEnd),
            transferSize: nav.transferSize,
          }
        : null,
      paint,
      lcpMs: lcp,
      marks,
      initialJsBytes: initialScript.reduce((s, r) => s + (r.encodedBodySize || r.transferSize || 0), 0),
      initialCssBytes: initialCss.reduce((s, r) => s + (r.encodedBodySize || r.transferSize || 0), 0),
      initialRequestCount: 1 + initialScript.length + initialCss.length,
      requestsBeforeHome: beforeHome.length,
      transferredBytesTotal: transferred,
      gnh: window.__GNH_PERF__ || null,
    }
  })
}

const { server, port } = await startServer()
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ bypassCSP: true })
await context.route('**/*', async (route) => {
  await route.continue()
})
const page = await context.newPage()
await page.addInitScript(() => {
  try {
    localStorage.setItem('gnh_perf', '1')
    localStorage.setItem('tcg_theme', 'neon-light')
  } catch {}
})

const url = `http://127.0.0.1:${port}${basePath}?gnh_perf=1`
// Hard reload with empty cache
await context.clearCookies()
const result = await measureOnce(page, url)

console.log(
  JSON.stringify(
    {
      label,
      dir,
      conditions: {
        cache: 'disabled (no-store + fresh context)',
        network: 'unthrottled local loopback',
        environment: 'Chromium Playwright (not Telegram WebView)',
        theme: 'neon-light',
      },
      url,
      result,
    },
    null,
    2,
  ),
)

await browser.close()
server.close()
