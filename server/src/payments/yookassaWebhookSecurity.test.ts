import assert from 'node:assert/strict'
import test from 'node:test'
import {
  evaluateYookassaWebhookAuth,
  evaluateYookassaWebhookIp,
  isYookassaNotificationIp,
} from './yookassaWebhookSecurity.js'

test('standard YooKassa webhook without Authorization is accepted when REQUIRE_SECRET is off', () => {
  const decision = evaluateYookassaWebhookAuth(
    { headers: {} },
    { YOOKASSA_WEBHOOK_SECRET: 'optional', YOOKASSA_WEBHOOK_REQUIRE_SECRET: '0' }
  )
  assert.deepEqual(decision, { ok: true, mode: 'api_verify' })
})

test('optional Bearer must match when Authorization is sent and secret is set', () => {
  const ok = evaluateYookassaWebhookAuth(
    { headers: { authorization: 'Bearer local-mock-webhook' } },
    { YOOKASSA_WEBHOOK_SECRET: 'local-mock-webhook', YOOKASSA_WEBHOOK_REQUIRE_SECRET: '0' }
  )
  assert.deepEqual(ok, { ok: true, mode: 'bearer_ok' })

  const bad = evaluateYookassaWebhookAuth(
    { headers: { authorization: 'Bearer wrong' } },
    { YOOKASSA_WEBHOOK_SECRET: 'local-mock-webhook', YOOKASSA_WEBHOOK_REQUIRE_SECRET: '0' }
  )
  assert.equal(bad.ok, false)
})

test('REQUIRE_SECRET=1 rejects missing Authorization even if secret is set', () => {
  const decision = evaluateYookassaWebhookAuth(
    { headers: {} },
    { YOOKASSA_WEBHOOK_SECRET: 'sec', YOOKASSA_WEBHOOK_REQUIRE_SECRET: '1' }
  )
  assert.deepEqual(decision, { ok: false, reason: 'bearer_required' })
})

test('official YooKassa notification IPs are recognized', () => {
  assert.equal(isYookassaNotificationIp('185.71.76.1'), true)
  assert.equal(isYookassaNotificationIp('77.75.156.11'), true)
  assert.equal(isYookassaNotificationIp('77.75.154.200'), true)
  assert.equal(isYookassaNotificationIp('2a02:5180:abcd::1'), true)
  assert.equal(isYookassaNotificationIp('203.0.113.10'), false)
  assert.equal(isYookassaNotificationIp('::ffff:185.71.76.2'), true)
})

test('IP check is opt-in and uses Express req.ip', () => {
  const off = evaluateYookassaWebhookIp({ ip: '203.0.113.10' }, { YOOKASSA_WEBHOOK_IP_CHECK: '0' })
  assert.equal(off.ok, true)
  assert.equal(off.checked, false)

  const deny = evaluateYookassaWebhookIp({ ip: '203.0.113.10' }, { YOOKASSA_WEBHOOK_IP_CHECK: '1' })
  assert.equal(deny.ok, false)

  const allow = evaluateYookassaWebhookIp({ ip: '185.71.77.5' }, { YOOKASSA_WEBHOOK_IP_CHECK: '1' })
  assert.equal(allow.ok, true)
  assert.equal(allow.checked, true)
})
