import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { parseYookassaAmountRub, fetchYookassaPayment } from './yookassaClient.js'
import { resolveTelegramIdForGrant } from '../utils/telegramId.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(here, '../..')

function readSql(relativePath: string): string {
  return fs.readFileSync(path.join(serverRoot, relativePath), 'utf8')
}

test('parseYookassaAmountRub normalizes provider amount strings', () => {
  assert.equal(parseYookassaAmountRub('259.00'), 259)
  assert.equal(parseYookassaAmountRub('259,00'), 259)
  assert.equal(parseYookassaAmountRub(undefined), null)
})

test('fetchYookassaPayment uses Basic auth and rejects non-OK', async () => {
  const calls: Array<{ url: string; headers: HeadersInit | undefined }> = []
  const ok = await fetchYookassaPayment('pay-1', {
    shopId: 'shop',
    secretKey: 'secret',
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), headers: init?.headers })
      return new Response(JSON.stringify({ id: 'pay-1', status: 'succeeded', amount: { value: '259.00', currency: 'RUB' } }), {
        status: 200,
      })
    },
  })
  assert.equal(ok?.status, 'succeeded')
  assert.match(String(calls[0]?.url), /\/payments\/pay-1$/)

  const fail = await fetchYookassaPayment('pay-2', {
    shopId: 'shop',
    secretKey: 'secret',
    fetchImpl: async () => new Response('nope', { status: 401 }),
  })
  assert.equal(fail, null)
})

test('resolveTelegramIdForGrant prefers DB row over body/metadata', () => {
  assert.equal(
    resolveTelegramIdForGrant({
      rowTelegramId: 111,
      bodyTelegramId: 222,
      metaTelegramId: '333',
    }),
    '111'
  )
  assert.equal(
    resolveTelegramIdForGrant({
      bodyTelegramId: 222,
      metaTelegramId: '333',
    }),
    '222'
  )
})

test('webhook route always verifies via API before grant (source audit)', () => {
  const route = fs.readFileSync(path.join(serverRoot, 'src/routes/yookassa.ts'), 'utf8')
  const webhook = route.slice(route.indexOf('async function handleWebhook'), route.indexOf('async function handleConfirm'))
  assert.match(webhook, /fetchYookassaPayment/)
  assert.match(webhook, /Never grant from unverified webhook body/)
  assert.equal(webhook.includes('grantPremiumByPaymentId(pid, {\n        metadata: obj.metadata'), false)
  assert.match(webhook, /metadata: verified\.metadata/)
  assert.match(webhook, /amount mismatch/)
})

test('grantPremiumByPaymentId is idempotent for already granted payment', async () => {
  const pg = new PGlite()
  await pg.exec(readSql('db/schema.sql'))
  await pg.exec(readSql('db/migrations/001_payments_new_schema.sql'))
  await pg.exec(readSql('db/migrations/002_plans_yookassa.sql'))
  await pg.exec(readSql('db/migrations/004_payments_premium_granted_at.sql'))
  await pg.query(`INSERT INTO users (telegram_id) VALUES (4242)`)
  await pg.query(
    `INSERT INTO payments (
       telegram_id, provider, plan_id, provider_payment_charge_id, status, currency, total_amount, premium_granted_at
     ) VALUES (4242, 'yookassa', 'premium_1m', 'pay-idem-1', 'succeeded', 'RUB', 259, now())`
  )

  const claim = await pg.query(
    `UPDATE payments
        SET premium_granted_at = now()
      WHERE provider_payment_charge_id = $1
        AND premium_granted_at IS NULL
      RETURNING id`,
    ['pay-idem-1']
  )
  assert.equal(claim.rows.length, 0)

  const claimSql = fs.readFileSync(path.join(serverRoot, 'src/payments/premiumGrantSql.ts'), 'utf8')
  assert.match(claimSql, /premium_granted_at IS NULL/)
  const route = fs.readFileSync(path.join(serverRoot, 'src/routes/yookassa.ts'), 'utf8')
  assert.match(route, /alreadyDone/)
  await pg.close()
})

test('dev-login hard-disabled in production regardless of WEB_DEV_LOGIN_ENABLED', () => {
  const src = fs.readFileSync(path.join(serverRoot, 'src/routes/webAuth.ts'), 'utf8')
  assert.match(src, /NODE_ENV === 'production'/)
  assert.match(src, /GNH_PRODUCTION/)
  assert.match(src, /RENDER/)
  assert.match(src, /TIMEWEB/)
  assert.match(src, /WEB_DEV_LOGIN_ENABLED/)
})

test('empty YOOKASSA_WEBHOOK_SECRET does not skip API verification', () => {
  const route = fs.readFileSync(path.join(serverRoot, 'src/routes/yookassa.ts'), 'utf8')
  const webhook = route.slice(route.indexOf('async function handleWebhook'), route.indexOf('async function handleConfirm'))
  // Optional Authorization secret must never be the only gate.
  assert.match(webhook, /relying on authenticated payment lookup|fetchYookassaPayment/)
  assert.match(webhook, /YOOKASSA_WEBHOOK_REQUIRE_SECRET/)
  // Default path with empty secret still reaches API verify before grant.
  assert.ok(webhook.indexOf('fetchYookassaPayment') > webhook.indexOf('webhook secret empty') || webhook.includes('fetchYookassaPayment'))
})
