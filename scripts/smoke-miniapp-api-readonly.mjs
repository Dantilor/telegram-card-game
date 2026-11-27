#!/usr/bin/env node
/**
 * Read-only smoke against the live production API (no payments, no DB writes).
 * Usage: node scripts/smoke-miniapp-api-readonly.mjs
 */
import { MINIAPP_PROD_API_ORIGIN } from './miniapp-production-config.mjs'

async function get(path) {
  const url = `${MINIAPP_PROD_API_ORIGIN}${path}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* ignore */ }
  return { url, status: res.status, json, text: text.slice(0, 200) }
}

const plans = await get('/api/plans')
const stats = await get('/api/public-stats')
console.log(JSON.stringify({ plans: { status: plans.status, ok: plans.json?.ok, planCount: plans.json?.plans?.length, samplePrice: plans.json?.plans?.[0]?.priceRub }, stats: { status: stats.status, usersCount: stats.json?.usersCount } }, null, 2))

if (plans.status !== 200 || !plans.json?.plans?.length) {
  console.error('FAIL: /api/plans')
  process.exit(1)
}
if (stats.status !== 200 || typeof stats.json?.usersCount !== 'number') {
  console.error('FAIL: /api/public-stats')
  process.exit(1)
}
console.log('[smoke-miniapp-api-readonly] OK')
