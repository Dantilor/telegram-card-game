#!/usr/bin/env node
/**
 * Fail Mini App production builds when API env is missing/conflicting/blocked.
 * Used by scripts/build-miniapp-production.mjs — do not skip.
 */
import {
  MINIAPP_BLOCKED_RENDER_HOST,
  MINIAPP_PROD_API_ORIGIN,
  normalizeApiOrigin,
} from './miniapp-production-config.mjs'

function fail(msg) {
  console.error('[check-miniapp-build-env] FAIL:', msg)
  process.exit(1)
}

const url = normalizeApiOrigin(process.env.VITE_API_URL)
const base = normalizeApiOrigin(process.env.VITE_API_BASE)
const baseUrlAlias = normalizeApiOrigin(process.env.VITE_API_BASE_URL)
const requireExactProd = process.argv.includes('--require-prod')

if (!url && !base) {
  fail(
    'VITE_API_URL and VITE_API_BASE are empty. resolveApiBase will throw api_not_configured. ' +
      'VITE_API_BASE_URL alone is NOT enough for the Mini App client.'
  )
}
if (!url || !base) {
  fail('Both VITE_API_URL and VITE_API_BASE must be set to the same origin for Mini App production builds.')
}
if (url !== base) {
  fail(`VITE_API_URL (${url}) !== VITE_API_BASE (${base}) — api_base_conflict`)
}

let host = ''
try {
  host = new URL(url).host
} catch {
  fail(`API origin is not a valid URL: ${url}`)
}
if (host === MINIAPP_BLOCKED_RENDER_HOST) {
  fail(`Blocked Render host: ${host}`)
}
if (baseUrlAlias && baseUrlAlias !== url) {
  fail(
    `VITE_API_BASE_URL (${baseUrlAlias}) differs from VITE_API_URL/VITE_API_BASE (${url}). ` +
      'Do not ship conflicting API aliases.'
  )
}
if (requireExactProd && url !== MINIAPP_PROD_API_ORIGIN) {
  fail(`Expected production API ${MINIAPP_PROD_API_ORIGIN}, got ${url}`)
}
if (baseUrlAlias && !url) {
  fail('VITE_API_BASE_URL is set but VITE_API_URL/VITE_API_BASE are not — this caused the 938fc40 regression.')
}

console.log('[check-miniapp-build-env] OK', {
  VITE_API_URL: url,
  VITE_API_BASE: base,
  VITE_API_BASE_URL: baseUrlAlias || '(unset)',
})
