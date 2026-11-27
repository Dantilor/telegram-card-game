#!/usr/bin/env node
/**
 * Post-build verification for Telegram Mini App dist (base=/).
 */
import fs from 'node:fs'
import path from 'node:path'
import {
  MINIAPP_BLOCKED_RENDER_HOST,
  MINIAPP_PROD_API_ORIGIN,
  MINIAPP_PROD_BASE,
  MINIAPP_WEB_PROMO_URL,
  normalizeApiOrigin,
} from './miniapp-production-config.mjs'
import { findDevelopmentMarkers, hasViteEnvLiteral } from './miniapp-build-mode.mjs'

const distDir = path.resolve(process.argv[2] || 'dist')

function fail(msg) {
  console.error('[check-miniapp-dist] FAIL:', msg)
  process.exit(1)
}

function read(rel) {
  return fs.readFileSync(path.join(distDir, rel), 'utf8')
}

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  fail(`Missing ${distDir}/index.html`)
}

const html = read('index.html')
if (html.includes('/telegram-card-game/')) {
  fail('index.html still references /telegram-card-game/ — production Mini App must use base=/')
}
const jsMatch = html.match(/src="(\/assets\/index-[^"]+\.js)"/)
const cssMatch = html.match(/href="(\/assets\/index-[^"]+\.css)"/)
if (!jsMatch) fail('index.html missing absolute /assets/index-*.js entry')
if (!cssMatch) fail('index.html missing absolute /assets/index-*.css entry')

const assetsDir = path.join(distDir, 'assets')
const jsFiles = fs.readdirSync(assetsDir).filter((f) => f.endsWith('.js'))
const allJs = jsFiles.map((f) => fs.readFileSync(path.join(assetsDir, f), 'utf8')).join('\n')

const urlNeedle = `VITE_API_URL:"${MINIAPP_PROD_API_ORIGIN}"`
const baseNeedle = `VITE_API_BASE:"${MINIAPP_PROD_API_ORIGIN}"`
if (!allJs.includes(urlNeedle)) {
  fail(`Compiled JS missing ${urlNeedle}. resolveApiBase will throw api_not_configured.`)
}
if (!allJs.includes(baseNeedle)) {
  fail(`Compiled JS missing ${baseNeedle}. Both VITE_API_URL and VITE_API_BASE must be inlined.`)
}

// Regression guard from 938fc40: BASE_URL alias alone is not enough.
const hasAliasOnlyEnv =
  /VITE_API_BASE_URL:"https:\/\/dantilor-telegram-card-game-3706\.twc1\.net"/.test(allJs) &&
  !allJs.includes(urlNeedle)
if (hasAliasOnlyEnv) {
  fail('Dist has VITE_API_BASE_URL but not VITE_API_URL — same failure mode as 938fc40.')
}

const promo = normalizeApiOrigin(MINIAPP_WEB_PROMO_URL)
if (!allJs.includes(promo) && !allJs.includes(MINIAPP_WEB_PROMO_URL)) {
  fail(`WEB promo URL missing from dist: ${MINIAPP_WEB_PROMO_URL}`)
}

if (/VITE_GNH_SHELL\s*:\s*["']web["']/.test(allJs) || allJs.includes('VITE_GNH_SHELL:"web"')) {
  fail('Dist looks like WEB-shell (VITE_GNH_SHELL=web). Mini App build must stay telegram shell.')
}

// Production React/Vite output only. MODE:"production" alone is not enough:
// NODE_ENV=development still yields MODE:"production" with DEV:!0 + jsxDEV.
if (!hasViteEnvLiteral(allJs)) {
  fail('Could not find inlined import.meta.env (DEV/PROD flags) in dist JS; cannot verify production mode.')
}
const devIssues = []
for (const f of jsFiles) {
  for (const issue of findDevelopmentMarkers(fs.readFileSync(path.join(assetsDir, f), 'utf8'))) {
    devIssues.push(`${f}: ${issue}`)
  }
}
if (devIssues.length) {
  fail(
    'Development build detected (check NODE_ENV=production for vite build):\n  ' +
      devIssues.slice(0, 12).join('\n  ') +
      (devIssues.length > 12 ? `\n  ...and ${devIssues.length - 12} more` : '')
  )
}

// Ensure production API origin is present; Render may appear only as the blocked constant.
if (!allJs.includes(MINIAPP_PROD_API_ORIGIN)) {
  fail(`Production API origin missing: ${MINIAPP_PROD_API_ORIGIN}`)
}
if (allJs.includes(`VITE_API_URL:"https://${MINIAPP_BLOCKED_RENDER_HOST}"`)) {
  fail('Dist inlines blocked Render host as VITE_API_URL')
}

console.log('[check-miniapp-dist] OK', {
  distDir,
  base: MINIAPP_PROD_BASE,
  entryJs: jsMatch[1],
  entryCss: cssMatch[1],
  mode: 'production (DEV=false, PROD=true, no jsxDEV)',
  api: MINIAPP_PROD_API_ORIGIN,
  promo: MINIAPP_WEB_PROMO_URL,
})
