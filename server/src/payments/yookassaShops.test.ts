import assert from 'node:assert/strict'
import test from 'node:test'
import {
  YookassaShopNotConfiguredError,
  verifyWebPayment,
  verifyWebRefund,
  yookassaBasicAuth,
  yookassaShopCredentials,
} from './yookassaShops.js'

const ENV = {
  YOOKASSA_SHOP_ID: 'tg-shop',
  YOOKASSA_SECRET_KEY: 'tg-secret',
  YOOKASSA_SHOP_ID_WEB: '1539987',
  YOOKASSA_SECRET_KEY_WEB: 'web-secret',
}

function shopOf(init?: RequestInit): string {
  const auth = new Headers(init?.headers).get('Authorization') || ''
  return Buffer.from(auth.replace(/^Basic /, ''), 'base64').toString('utf8').split(':')[0] || ''
}

function api(answers: Record<string, () => Response>) {
  const asked: string[] = []
  const fetchImpl = (async (_url: RequestInfo | URL, init?: RequestInit) => {
    const shop = shopOf(init)
    asked.push(shop)
    return (answers[shop] ?? (() => new Response('{}', { status: 404 })))()
  }) as typeof fetch
  return { asked, fetchImpl }
}

const payment = (id: string, accountId: string, status = 'succeeded') => () =>
  new Response(JSON.stringify({ id, status, amount: { value: '259.00', currency: 'RUB' }, recipient: { account_id: accountId } }), {
    status: 200,
  })

test('credentials are isolated per shop; WEB never borrows Telegram keys', () => {
  assert.deepEqual(yookassaShopCredentials('telegram', ENV), { shop: 'telegram', shopId: 'tg-shop', secretKey: 'tg-secret' })
  assert.deepEqual(yookassaShopCredentials('web', ENV), { shop: 'web', shopId: '1539987', secretKey: 'web-secret' })
  assert.equal(yookassaShopCredentials('web', { YOOKASSA_SHOP_ID: 'tg-shop', YOOKASSA_SECRET_KEY: 'tg-secret' }), null)
  assert.equal(yookassaShopCredentials('web', { ...ENV, YOOKASSA_SECRET_KEY_WEB: '  ' }), null)
  assert.ok(yookassaShopCredentials('telegram', { YOOKASSA_SHOP_ID: 'tg-shop', YOOKASSA_SECRET_KEY: 'tg-secret' }))
  assert.equal(yookassaBasicAuth({ shop: 'web', shopId: '1539987', secretKey: 's' }), 'Basic ' + Buffer.from('1539987:s').toString('base64'))
})

test('WEB payment is verified by the WEB shop without asking the Telegram shop', async () => {
  const { asked, fetchImpl } = api({ '1539987': payment('p1', '1539987') })
  const result = await verifyWebPayment('p1', { env: ENV, fetchImpl })
  assert.equal(result?.verifiedBy, 'web')
  assert.deepEqual(asked, ['1539987'])
})

test('legacy Telegram shop is asked only after a 404 from the WEB shop', async () => {
  const { asked, fetchImpl } = api({ 'tg-shop': payment('p2', 'tg-shop') })
  const result = await verifyWebPayment('p2', { env: ENV, fetchImpl })
  assert.equal(result?.verifiedBy, 'telegram_legacy')
  assert.deepEqual(asked, ['1539987', 'tg-shop'])
})

test('no legacy lookup on WEB auth errors, provider errors or other rejections', async () => {
  for (const status of [401, 403, 500, 503]) {
    const { asked, fetchImpl } = api({ '1539987': () => new Response('x', { status }), 'tg-shop': payment('p3', 'tg-shop') })
    await assert.rejects(() => verifyWebPayment('p3', { env: ENV, fetchImpl }))
    assert.deepEqual(asked, ['1539987'], `status ${status}`)
  }
  const { asked, fetchImpl } = api({ '1539987': () => new Response('x', { status: 400 }), 'tg-shop': payment('p4', 'tg-shop') })
  assert.equal(await verifyWebPayment('p4', { env: ENV, fetchImpl }), null)
  assert.deepEqual(asked, ['1539987'])
})

test('a payment answered with a different recipient or id is rejected', async () => {
  const wrongRecipient = api({ '1539987': payment('p5', 'someone-else') })
  assert.equal(await verifyWebPayment('p5', { env: ENV, fetchImpl: wrongRecipient.fetchImpl }), null)
  const wrongId = api({ '1539987': payment('other-id', '1539987') })
  assert.equal(await verifyWebPayment('p6', { env: ENV, fetchImpl: wrongId.fetchImpl }), null)
})

test('unknown everywhere -> null; missing WEB keys -> controlled error with no lookup', async () => {
  const nowhere = api({})
  assert.equal(await verifyWebPayment('ghost', { env: ENV, fetchImpl: nowhere.fetchImpl }), null)
  assert.deepEqual(nowhere.asked, ['1539987', 'tg-shop'])

  const none = api({ 'tg-shop': payment('p7', 'tg-shop') })
  await assert.rejects(
    () => verifyWebPayment('p7', { env: { YOOKASSA_SHOP_ID: 'tg-shop', YOOKASSA_SECRET_KEY: 'tg-secret' }, fetchImpl: none.fetchImpl }),
    (error: unknown) => error instanceof YookassaShopNotConfiguredError && error.shop === 'web'
  )
  assert.deepEqual(none.asked, [])
})

test('WEB refunds use the same routing and require payment_id', async () => {
  const refund = (paymentId?: string) => () =>
    new Response(JSON.stringify({ id: 'r1', status: 'succeeded', payment_id: paymentId, amount: { value: '259.00', currency: 'RUB' } }), {
      status: 200,
    })
  const web = api({ '1539987': refund('p1') })
  assert.equal((await verifyWebRefund('r1', { env: ENV, fetchImpl: web.fetchImpl }))?.verifiedBy, 'web')
  const legacy = api({ 'tg-shop': refund('p1') })
  assert.equal((await verifyWebRefund('r1', { env: ENV, fetchImpl: legacy.fetchImpl }))?.verifiedBy, 'telegram_legacy')
  const broken = api({ '1539987': refund(undefined) })
  assert.equal(await verifyWebRefund('r1', { env: ENV, fetchImpl: broken.fetchImpl }), null)
})