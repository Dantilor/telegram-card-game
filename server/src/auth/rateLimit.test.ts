import assert from 'node:assert/strict'
import test from 'node:test'
import { clientIpFromRequest, consumeRateLimit, resetRateLimitBuckets } from './rateLimit.js'

test('clientIpFromRequest uses Express req.ip, not raw X-Forwarded-For', () => {
  const ip = clientIpFromRequest({
    ip: '203.0.113.10',
    headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
  } as { ip?: string; headers?: Record<string, unknown> })
  assert.equal(ip, '203.0.113.10')
})

test('memory rate limit trips after N hits', () => {
  resetRateLimitBuckets()
  assert.equal(consumeRateLimit('t', 2, 60_000).ok, true)
  assert.equal(consumeRateLimit('t', 2, 60_000).ok, true)
  assert.equal(consumeRateLimit('t', 2, 60_000).ok, false)
})
