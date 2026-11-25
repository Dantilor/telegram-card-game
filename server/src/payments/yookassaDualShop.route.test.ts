/**
 * End-to-end route test for the two YooKassa shops (Telegram Mini App + WEB).
 * Real /api router, PGlite instead of the production pool, and a fake YooKassa API
 * that enforces Basic auth per shop and returns 404 for another shop's objects.
 * Run: tsx --experimental-test-module-mocks --test src/payments/yookassaDualShop.route.test.ts
 */
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import test, { after, before, mock } from 'node:test'
import express from 'express'
import { PGlite } from '@electric-sql/pglite'

const here = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(here, '../..')
const BOT_TOKEN = '123456:DUAL-SHOP-TEST'
const TG_SHOP = { id: 'tg-shop-test', secret: 'tg-secret-test' }
const WEB_SHOP = { id: '1539987', secret: 'web-secret-test' }
const WEB_RETURN = 'https://play.gamenighthost.ru/premium?payment=return'
const TG_RETURN = 'https://t.me/GameNightHostBot/app?startapp=premium'

function baseEnv(): void {
  process.env.NODE_ENV = 'test'
  process.env.YOOKASSA_MOCK = '0'
  process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN
  process.env.YOOKASSA_SHOP_ID = TG_SHOP.id
  process.env.YOOKASSA_SECRET_KEY = TG_SHOP.secret
  process.env.YOOKASSA_SHOP_ID_WEB = WEB_SHOP.id
  process.env.YOOKASSA_SECRET_KEY_WEB = WEB_SHOP.secret
  process.env.YOOKASSA_RETURN_URL = TG_RETURN
  process.env.YOOKASSA_RETURN_URL_WEB = WEB_RETURN
  process.env.YOOKASSA_WEBHOOK_IP_CHECK = '0'
  process.env.YOOKASSA_WEBHOOK_REQUIRE_SECRET = '0'
  delete process.env.YOOKASSA_WEBHOOK_SECRET
  process.env.GNH_WEB_ENABLED = '1'
  process.env.WEB_EMAIL_OTP_ECHO = '1'
  delete process.env.SMTP_ENABLED
}
baseEnv()

// ---------- PGlite standing in for the production pool ----------
const pg = new PGlite()
const sql = (rel: string) => fs.readFileSync(path.join(serverRoot, rel), 'utf8')
for (const file of [
  'db/schema.sql',
  'db/migrations/001_payments_new_schema.sql',
  'db/migrations/002_plans_yookassa.sql',
  'db/staging/003_plans_three_tiers_fixed.sql',
  'db/migrations/004_payments_premium_granted_at.sql',
  'db/migrations/005_legal_documents.sql',
  'db/migrations/012_web_sessions.sql',
  'db/migrations/013_web_session_profile.sql',
  'db/migrations/014_legal_confirmation_source_web.sql',
  'db/migrations/017_web_anonymous_accounts.sql',
  'db/migrations/018_web_rate_buckets.sql',
  'db/migrations/019_web_legal_subjects.sql',
  'db/migrations/020_web_email_magic_links.sql',
  'db/migrations/022_web_plans_audience.sql',
  'db/migrations/023_web_plans_activate.sql',
]) {
  await pg.exec(sql(file))
}
// Production payments has no provider column (see premiumGrantSql.ts).
await pg.exec(`
  ALTER TABLE payments DROP COLUMN IF EXISTS provider;
  CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_charge_uq
    ON payments (provider_payment_charge_id) WHERE provider_payment_charge_id IS NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_telegram_id_uidx ON subscriptions (telegram_id);
  CREATE UNIQUE INDEX IF NOT EXISTS payments_telegram_charge_uq
    ON payments (telegram_payment_charge_id) WHERE telegram_payment_charge_id IS NOT NULL;
`)

const run = async (text: string, params?: unknown[]) => {
  const result = await pg.query(text, params as unknown[] | undefined)
  return { rows: result.rows as Record<string, unknown>[], rowCount: result.rows.length }
}
mock.module(new URL('../db.ts', import.meta.url).href, {
  namedExports: {
    query: run,
    pool: {
      query: run,
      connect: async () => ({ query: run, release: () => {} }),
      on: () => {},
    },
    dbPing: async () => {},
    allowLocalPlaintextDatabase: () => false,
  },
})

// ---------- fake YooKassa API with two shops ----------
type FakePayment = {
  id: string
  status: string
  amount: { value: string; currency: string }
  metadata: Record<string, string>
  recipient: { account_id: string }
  receipt?: { customer?: { email?: string } }
  return_url?: string
}
type FakeRefund = { id: string; status: string; payment_id: string; amount: { value: string; currency: string } }
const shops = new Map([
  [TG_SHOP.id, TG_SHOP.secret],
  [WEB_SHOP.id, WEB_SHOP.secret],
])
const store = {
  payments: new Map<string, { shop: string; object: FakePayment }>(),
  refunds: new Map<string, { shop: string; object: FakeRefund }>(),
}
const apiCalls: Array<{ shop: string; method: string; path: string }> = []
let seq = 0
let providerDown = false
const realFetch = globalThis.fetch

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input)
  if (!url.startsWith('https://api.yookassa.ru/v3/')) return realFetch(input, init)
  const headers = new Headers(init?.headers)
  const basic = (headers.get('Authorization') || '').replace(/^Basic /, '')
  const [shop, secret] = Buffer.from(basic, 'base64').toString('utf8').split(':')
  if (!shop || shops.get(shop) !== secret) return json({ type: 'error', code: 'invalid_credentials' }, 401)
  const method = (init?.method || 'GET').toUpperCase()
  const apiPath = url.slice('https://api.yookassa.ru/v3'.length)
  apiCalls.push({ shop, method, path: apiPath })

  if (method === 'POST' && apiPath === '/payments') {
    const body = JSON.parse(String(init?.body)) as {
      amount: FakePayment['amount']
      metadata: Record<string, string>
      receipt?: FakePayment['receipt']
      confirmation: { return_url: string }
    }
    const id = `${shop}-pay-${++seq}`
    store.payments.set(id, {
      shop,
      object: {
        id,
        status: 'pending',
        amount: body.amount,
        metadata: body.metadata,
        recipient: { account_id: shop },
        receipt: body.receipt,
        return_url: body.confirmation.return_url,
      },
    })
    return json({ id, status: 'pending', confirmation: { confirmation_url: `https://yoomoney.ru/checkout/${id}` } })
  }
  const pay = apiPath.match(/^\/payments\/([^/]+)$/)
  if (method === 'GET' && pay) {
    if (providerDown) return json({ type: 'error', code: 'internal_server_error' }, 500)
    const found = store.payments.get(decodeURIComponent(pay[1]!))
    return found && found.shop === shop ? json(found.object) : json({ type: 'error', code: 'not_found' }, 404)
  }
  const ref = apiPath.match(/^\/refunds\/([^/]+)$/)
  if (method === 'GET' && ref) {
    const found = store.refunds.get(decodeURIComponent(ref[1]!))
    return found && found.shop === shop ? json(found.object) : json({ type: 'error', code: 'not_found' }, 404)
  }
  return json({ type: 'error', code: 'unexpected' }, 400)
}) as typeof fetch

const { default: router } = await import('../routes/yookassa.js')
const { default: webAuthRouter } = await import('../routes/webAuth.js')
const { importDocuments, activateDocuments, readActiveDocument } = await import('../legal/documents.js')
const { DOCUMENT_CATALOG, CONFIRMATION_SOURCE } = await import('../legal/constants.js')
const { sha256Utf8 } = await import('../legal/hash.js')
const { createAnonymousWebAccountSession } = await import('../auth/webAccounts.js')
const { SESSION_COOKIE, CSRF_COOKIE } = await import('../auth/cookies.js')

const queryable = { query: async <T,>(text: string, params?: unknown[]) => ({ rows: (await run(text, params)).rows as T[] }) }
const withTransaction = async <T,>(fn: (q: typeof queryable) => Promise<T>) => fn(queryable)

// ---------- app + helpers ----------
let baseUrl = ''
let server: http.Server
before(async () => {
  const offerText = 'FICTIONAL offer for dual-shop route test\n'
  const offer = {
    id: 'offer' as const,
    version: '2026-10-20.1',
    title: 'Fiction offer',
    kind: DOCUMENT_CATALOG.offer.kind,
    scope: DOCUMENT_CATALOG.offer.scope,
    documentDate: '2026-10-20',
    sha256: sha256Utf8(offerText),
    bodyMarkdown: offerText,
    blocks: [{ type: 'paragraph' as const, text: offerText.trim() }],
    requiresIndividualDetails: DOCUMENT_CATALOG.offer.individual,
  }
  await importDocuments(withTransaction as never, [offer] as never)
  await activateDocuments(withTransaction as never, [offer] as never)
  const app = express()
  app.use(express.json())
  app.use('/api', router)
  app.use('/api', webAuthRouter)
  server = http.createServer(app)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  baseUrl = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`
})
after(async () => {
  server.close()
  globalThis.fetch = realFetch
  await pg.close()
})

async function plan(planId: string) {
  const r = await run(`SELECT plan_id, price_rub, duration_days FROM plans WHERE plan_id = $1`, [planId])
  const row = r.rows[0]!
  return { planId: String(row.plan_id), priceRub: Number(row.price_rub), durationDays: Number(row.duration_days) }
}

async function activeOffer() {
  const doc = await readActiveDocument(queryable as never, 'offer', true)
  assert.ok(doc, 'active offer')
  return doc!
}

function signInitData(userId: number): string {
  const authDate = Math.floor(Date.now() / 1000)
  const user = JSON.stringify({ id: userId, first_name: 'Test' })
  const dataCheckString = [`auth_date=${authDate}`, `user=${user}`].sort().join('\n')
  const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest()
  const hash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex')
  return `auth_date=${authDate}&user=${encodeURIComponent(user)}&hash=${hash}`
}

async function telegramBuyer(telegramId: number, planId = 'premium_1m') {
  await run(`INSERT INTO users (telegram_id) VALUES ($1) ON CONFLICT DO NOTHING`, [telegramId])
  const p = await plan(planId)
  const doc = await activeOffer()
  const ev = await run(
    `INSERT INTO legal_evidence (subject_telegram_id, action, document_id, document_version, document_sha256,
       context, confirmation_source, request_id)
     VALUES ($1, 'accept_offer', 'offer', $2, $3, $4::jsonb, $5, $6) RETURNING id`,
    [telegramId, doc.version, doc.sha256, JSON.stringify({ ...p, currency: 'RUB' }), CONFIRMATION_SOURCE, `tg-${telegramId}-${++seq}`]
  )
  return { initData: signInitData(telegramId), planId, evidenceId: Number(ev.rows[0]!.id) }
}

async function webBuyer(planId = 'premium_web_3m') {
  const session = await createAnonymousWebAccountSession({ db: queryable as never })
  const p = await plan(planId)
  const doc = await activeOffer()
  const ev = await run(
    `INSERT INTO web_legal_evidence (subject_web_account_id, action, document_id, document_version, document_sha256,
       context, request_id)
     VALUES ($1::uuid, 'accept_offer', 'offer', $2, $3, $4::jsonb, $5) RETURNING id`,
    [session.webAccountId, doc.version, doc.sha256, JSON.stringify({ ...p, currency: 'RUB' }), `web-${++seq}`]
  )
  return {
    webAccountId: session.webAccountId,
    headers: {
      Cookie: `${SESSION_COOKIE}=${session.sessionToken}; ${CSRF_COOKIE}=${session.csrfToken}`,
      'X-CSRF-Token': session.csrfToken,
    },
    planId,
    evidenceId: Number(ev.rows[0]!.id),
  }
}

async function post(pathname: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await realFetch(`${baseUrl}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  return { status: res.status, body: (text ? JSON.parse(text) : {}) as Record<string, unknown> }
}

async function createWeb(buyer: Awaited<ReturnType<typeof webBuyer>>) {
  return post(
    '/api/payments/yookassa/create',
    { planId: buyer.planId, offerAcceptanceId: buyer.evidenceId, email: 'buyer@example.com' },
    buyer.headers
  )
}

async function createTelegram(buyer: Awaited<ReturnType<typeof telegramBuyer>>) {
  return post(
    '/api/payments/yookassa/create',
    { planId: buyer.planId, offerAcceptanceId: buyer.evidenceId, email: 'tg-buyer@example.com' },
    { 'X-Telegram-Init-Data': buyer.initData }
  )
}

const webhook = (event: string, object: Record<string, unknown>) =>
  post('/api/yookassa/webhook', { type: 'notification', event, object })

function markPaid(paymentId: string) {
  const found = store.payments.get(paymentId)!
  found.object.status = 'succeeded'
}

async function webEntitlements(webAccountId: string) {
  return (
    await run(
      `SELECT payment_id, active_until > now() AS active FROM web_entitlements WHERE web_account_id = $1::uuid`,
      [webAccountId]
    )
  ).rows
}

const counts = async () => ({
  subscriptions: Number((await run(`SELECT count(*)::int AS c FROM subscriptions`)).rows[0]!.c),
  webEntitlements: Number((await run(`SELECT count(*)::int AS c FROM web_entitlements`)).rows[0]!.c),
  payments: Number((await run(`SELECT count(*)::int AS c FROM payments`)).rows[0]!.c),
  webPayments: Number((await run(`SELECT count(*)::int AS c FROM web_payments`)).rows[0]!.c),
})

function callsFor(id: string) {
  return apiCalls.filter((c) => c.path.endsWith(`/${id}`))
}

// ---------- tests ----------
test('1. Telegram create uses the original Telegram shop and Mini App return URL', async () => {
  const buyer = await telegramBuyer(910001)
  const res = await createTelegram(buyer)
  assert.equal(res.status, 200, JSON.stringify(res.body))
  const id = String(res.body.paymentId)
  assert.equal(store.payments.get(id)?.shop, TG_SHOP.id)
  assert.equal(store.payments.get(id)?.object.return_url, TG_RETURN)
  const row = await run(`SELECT telegram_id::text AS t FROM payments WHERE provider_payment_charge_id = $1`, [id])
  assert.equal(row.rows[0]?.t, '910001')
  assert.equal((await run(`SELECT 1 FROM web_payments WHERE id = $1`, [id])).rows.length, 0)
})

test('2. WEB create uses only the WEB shop with server price, receipt email and WEB return URL', async () => {
  const buyer = await webBuyer('premium_web_3m')
  const res = await createWeb(buyer)
  assert.equal(res.status, 200, JSON.stringify(res.body))
  const id = String(res.body.paymentId)
  const created = store.payments.get(id)!
  assert.equal(created.shop, WEB_SHOP.id)
  assert.equal(created.object.amount.value, '499.00')
  assert.equal(created.object.receipt?.customer?.email, 'buyer@example.com')
  assert.equal(created.object.return_url, WEB_RETURN)
  assert.equal(created.object.metadata.web_account_id, buyer.webAccountId)
  const row = await run(`SELECT amount_rub, web_account_id::text AS w FROM web_payments WHERE id = $1`, [id])
  assert.equal(Number(row.rows[0]?.amount_rub), 499)
  assert.equal(row.rows[0]?.w, buyer.webAccountId)
  assert.equal(apiCalls.some((c) => c.method === 'POST' && c.shop === TG_SHOP.id && callsFor(id).length), false)
})

test('2b. WEB checkout requires an authenticated WEB session (no session -> 401, bad CSRF -> 401)', async () => {
  const buyer = await webBuyer('premium_web_1m')
  const noAuth = await post('/api/payments/yookassa/create', { planId: 'premium_web_1m', email: 'a@example.com' })
  assert.equal(noAuth.status, 401)
  const badCsrf = await post(
    '/api/payments/yookassa/create',
    { planId: buyer.planId, offerAcceptanceId: buyer.evidenceId, email: 'buyer@example.com' },
    { Cookie: buyer.headers.Cookie, 'X-CSRF-Token': 'wrong' }
  )
  assert.equal(badCsrf.status, 401)
})

test('3. Missing WEB keys: WEB checkout fails closed, Telegram keeps working', async () => {
  const before = apiCalls.length
  delete process.env.YOOKASSA_SHOP_ID_WEB
  delete process.env.YOOKASSA_SECRET_KEY_WEB
  try {
    const web = await createWeb(await webBuyer('premium_web_1m'))
    assert.equal(web.status, 503)
    assert.equal(web.body.code, 'payment_not_configured')
    assert.equal(apiCalls.length, before, 'no provider call, no fallback to the Telegram shop')

    const tg = await createTelegram(await telegramBuyer(910002))
    assert.equal(tg.status, 200, JSON.stringify(tg.body))
    assert.equal(store.payments.get(String(tg.body.paymentId))?.shop, TG_SHOP.id)
  } finally {
    baseEnv()
  }
})

test('4+5+7+8. WEB webhook grants once via WEB shop, never touches Telegram tables', async () => {
  const buyer = await webBuyer('premium_web_1m')
  const id = String((await createWeb(buyer)).body.paymentId)
  markPaid(id)
  const before = await counts()

  const first = await webhook('payment.succeeded', { id, status: 'succeeded' })
  assert.equal(first.status, 200)
  const verify = callsFor(id).filter((c) => c.method === 'GET')
  assert.ok(verify.length >= 1)
  assert.ok(verify.every((c) => c.shop === WEB_SHOP.id), 'verified only through the WEB shop')

  const ent = await webEntitlements(buyer.webAccountId)
  assert.equal(ent.length, 1)
  assert.equal(ent[0]?.active, true)
  const grantedAt = (await run(`SELECT premium_granted_at FROM web_payments WHERE id = $1`, [id])).rows[0]?.premium_granted_at
  assert.ok(grantedAt)

  for (let i = 0; i < 3; i += 1) {
    assert.equal((await webhook('payment.succeeded', { id, status: 'succeeded' })).status, 200)
  }
  assert.equal((await webEntitlements(buyer.webAccountId)).length, 1, 'repeat webhook does not grant again')
  const grantedAgain = (await run(`SELECT premium_granted_at FROM web_payments WHERE id = $1`, [id])).rows[0]
    ?.premium_granted_at
  assert.equal(String(grantedAgain), String(grantedAt))

  const afterCounts = await counts()
  assert.equal(afterCounts.subscriptions, before.subscriptions, 'WEB webhook does not write subscriptions')
  assert.equal(afterCounts.payments, before.payments, 'WEB webhook does not write Telegram payments')
  assert.equal(afterCounts.webEntitlements, before.webEntitlements + 1)
})

test('5. Telegram webhook grants via Telegram shop and does not change WEB payments', async () => {
  const buyer = await telegramBuyer(910003)
  const id = String((await createTelegram(buyer)).body.paymentId)
  markPaid(id)
  const webBefore = (await run(`SELECT id, status, premium_granted_at FROM web_payments ORDER BY id`)).rows
  const entBefore = (await counts()).webEntitlements

  const res = await webhook('payment.succeeded', { id, status: 'succeeded', metadata: { telegram_id: '910003' } })
  assert.equal(res.status, 200)
  assert.ok(callsFor(id).filter((c) => c.method === 'GET').every((c) => c.shop === TG_SHOP.id))
  const sub = await run(`SELECT active_until > now() AS active FROM subscriptions WHERE telegram_id = 910003`)
  assert.equal(sub.rows[0]?.active, true)
  const granted = await run(`SELECT premium_granted_at FROM payments WHERE provider_payment_charge_id = $1`, [id])
  assert.ok(granted.rows[0]?.premium_granted_at)

  assert.deepEqual((await run(`SELECT id, status, premium_granted_at FROM web_payments ORDER BY id`)).rows, webBefore)
  assert.equal((await counts()).webEntitlements, entBefore)

  await webhook('payment.succeeded', { id, status: 'succeeded' })
  const subs = await run(`SELECT count(*)::int AS c FROM subscriptions WHERE telegram_id = 910003`)
  assert.equal(Number(subs.rows[0]?.c), 1)
})

test('6. Historical WEB order created in the Telegram shop before the split is still verified', async () => {
  const buyer = await webBuyer('premium_web_1m')
  const legacyId = `${TG_SHOP.id}-legacy-web-1`
  store.payments.set(legacyId, {
    shop: TG_SHOP.id,
    object: {
      id: legacyId,
      status: 'succeeded',
      amount: { value: '259.00', currency: 'RUB' },
      metadata: { web_account_id: buyer.webAccountId, plan_id: 'premium_web_1m' },
      recipient: { account_id: TG_SHOP.id },
    },
  })
  await run(
    `INSERT INTO web_payments (id, web_account_id, plan_id, amount_rub, status) VALUES ($1, $2::uuid, 'premium_web_1m', 259, 'pending')`,
    [legacyId, buyer.webAccountId]
  )
  const res = await webhook('payment.succeeded', { id: legacyId, status: 'succeeded' })
  assert.equal(res.status, 200)
  const shopsAsked = callsFor(legacyId).map((c) => c.shop)
  assert.deepEqual(shopsAsked, [WEB_SHOP.id, TG_SHOP.id], 'WEB shop first (404), then legacy shop')
  assert.equal((await webEntitlements(buyer.webAccountId)).length, 1)
})

test('6b. Historical Telegram payment (pre-split) is verified by the Telegram shop only', async () => {
  await run(`INSERT INTO users (telegram_id) VALUES (910004) ON CONFLICT DO NOTHING`)
  const oldId = `${TG_SHOP.id}-legacy-tg-1`
  store.payments.set(oldId, {
    shop: TG_SHOP.id,
    object: {
      id: oldId,
      status: 'succeeded',
      amount: { value: '399.00', currency: 'RUB' },
      metadata: { telegram_id: '910004', plan_id: 'premium_3m' },
      recipient: { account_id: TG_SHOP.id },
    },
  })
  await run(
    `INSERT INTO payments (telegram_id, plan_id, currency, total_amount, provider_payment_charge_id, status)
     VALUES (910004, 'premium_3m', 'RUB', 399, $1, 'pending')`,
    [oldId]
  )
  assert.equal((await webhook('payment.succeeded', { id: oldId, status: 'succeeded' })).status, 200)
  assert.deepEqual(callsFor(oldId).map((c) => c.shop), [TG_SHOP.id])
  const sub = await run(`SELECT active_until > now() AS active FROM subscriptions WHERE telegram_id = 910004`)
  assert.equal(sub.rows[0]?.active, true)
})

test('10. Forged webhooks never grant Premium', async () => {
  const buyer = await webBuyer('premium_web_lifetime')
  const before = await counts()

  // Unknown id with a convincing body: Telegram shop says 404, no grant, no WEB lookup.
  const unknown = await webhook('payment.succeeded', {
    id: 'forged-unknown-1',
    status: 'succeeded',
    amount: { value: '1190.00', currency: 'RUB' },
    metadata: { web_account_id: buyer.webAccountId, plan_id: 'premium_web_lifetime' },
  })
  assert.equal(unknown.status, 200)
  assert.deepEqual(callsFor('forged-unknown-1').map((c) => c.shop), [TG_SHOP.id])

  // Real pending WEB order, body claims success: API says pending -> no grant.
  const id = String((await createWeb(buyer)).body.paymentId)
  await webhook('payment.succeeded', { id, status: 'succeeded' })

  // Refund forged for the Telegram shop object of a WEB payment: refund unknown to both shops.
  await webhook('refund.succeeded', { id: 'forged-refund-1', payment_id: id, status: 'succeeded' })

  const afterCounts = await counts()
  assert.equal(afterCounts.webEntitlements, before.webEntitlements)
  assert.equal(afterCounts.subscriptions, before.subscriptions)
  assert.equal((await run(`SELECT status FROM web_payments WHERE id = $1`, [id])).rows[0]?.status, 'pending')
})

test('9. Refunds: full refund revokes only that WEB purchase, partial keeps it, Telegram untouched', async () => {
  const subsBefore = (await run(`SELECT telegram_id, active_until FROM subscriptions ORDER BY telegram_id`)).rows

  const full = await webBuyer('premium_web_1m')
  const fullId = String((await createWeb(full)).body.paymentId)
  markPaid(fullId)
  await webhook('payment.succeeded', { id: fullId, status: 'succeeded' })
  store.refunds.set('rf-full-1', {
    shop: WEB_SHOP.id,
    object: { id: 'rf-full-1', status: 'succeeded', payment_id: fullId, amount: { value: '259.00', currency: 'RUB' } },
  })
  assert.equal((await webhook('refund.succeeded', { id: 'rf-full-1', payment_id: fullId, status: 'succeeded' })).status, 200)
  assert.deepEqual(callsFor('rf-full-1').map((c) => c.shop), [WEB_SHOP.id])
  assert.equal((await run(`SELECT status FROM web_payments WHERE id = $1`, [fullId])).rows[0]?.status, 'refunded')
  assert.equal((await webEntitlements(full.webAccountId))[0]?.active, false)

  const part = await webBuyer('premium_web_3m')
  const partId = String((await createWeb(part)).body.paymentId)
  markPaid(partId)
  await webhook('payment.succeeded', { id: partId, status: 'succeeded' })
  store.refunds.set('rf-part-1', {
    shop: WEB_SHOP.id,
    object: { id: 'rf-part-1', status: 'succeeded', payment_id: partId, amount: { value: '100.00', currency: 'RUB' } },
  })
  await webhook('refund.succeeded', { id: 'rf-part-1', payment_id: partId, status: 'succeeded' })
  assert.equal((await run(`SELECT status FROM web_payments WHERE id = $1`, [partId])).rows[0]?.status, 'partially_refunded')
  assert.equal((await webEntitlements(part.webAccountId))[0]?.active, true)

  assert.deepEqual((await run(`SELECT telegram_id, active_until FROM subscriptions ORDER BY telegram_id`)).rows, subsBefore)
})

test('9b. Cancel: WEB cancel verified via WEB shop, no grant', async () => {
  const buyer = await webBuyer('premium_web_1m')
  const id = String((await createWeb(buyer)).body.paymentId)
  store.payments.get(id)!.object.status = 'canceled'
  assert.equal((await webhook('payment.canceled', { id, status: 'canceled' })).status, 200)
  assert.equal((await run(`SELECT status FROM web_payments WHERE id = $1`, [id])).rows[0]?.status, 'canceled')
  assert.ok(callsFor(id).filter((c) => c.method === 'GET').every((c) => c.shop === WEB_SHOP.id))
  assert.equal((await webEntitlements(buyer.webAccountId)).length, 0)
})

test('WEB confirm after return verifies via WEB shop; unknown id is rejected without provider call', async () => {
  const buyer = await webBuyer('premium_web_1m')
  const id = String((await createWeb(buyer)).body.paymentId)
  const pending = await post('/api/yookassa/confirm', { paymentId: id }, buyer.headers)
  assert.equal(pending.body.ok, false)
  assert.equal(pending.body.status, 'pending')
  markPaid(id)
  const ok = await post('/api/yookassa/confirm', { paymentId: id }, buyer.headers)
  assert.equal(ok.status, 200, JSON.stringify(ok.body))
  assert.equal(ok.body.ok, true)
  assert.ok(callsFor(id).filter((c) => c.method === 'GET').every((c) => c.shop === WEB_SHOP.id))
  const again = await post('/api/yookassa/confirm', { paymentId: id }, buyer.headers)
  assert.equal(again.body.alreadyDone, true)
  assert.equal((await webEntitlements(buyer.webAccountId)).length, 1)

  const before = apiCalls.length
  const unknown = await post('/api/yookassa/confirm', { paymentId: 'not-mine-123' }, buyer.headers)
  assert.equal(unknown.status, 404)
  assert.equal(apiCalls.length, before)

  const other = await webBuyer('premium_web_1m')
  const stolen = await post('/api/yookassa/confirm', { paymentId: id }, other.headers)
  assert.equal(stolen.status, 403)
})

test('WEB webhook while WEB keys are missing returns 500 so YooKassa retries, then grants once', async () => {
  const buyer = await webBuyer('premium_web_1m')
  const id = String((await createWeb(buyer)).body.paymentId)
  markPaid(id)
  delete process.env.YOOKASSA_SHOP_ID_WEB
  delete process.env.YOOKASSA_SECRET_KEY_WEB
  try {
    const res = await webhook('payment.succeeded', { id, status: 'succeeded' })
    assert.equal(res.status, 500)
    assert.equal((await webEntitlements(buyer.webAccountId)).length, 0)
    assert.equal(callsFor(id).filter((c) => c.method === 'GET').length, 0, 'no fallback lookup in the Telegram shop')
  } finally {
    baseEnv()
  }
  assert.equal((await webhook('payment.succeeded', { id, status: 'succeeded' })).status, 200)
  assert.equal((await webEntitlements(buyer.webAccountId)).length, 1)
})

test('Secrets never appear in API responses', async () => {
  const buyer = await webBuyer('premium_web_1m')
  const res = await createWeb(buyer)
  const text = JSON.stringify(res.body)
  assert.equal(text.includes(WEB_SHOP.secret), false)
  assert.equal(text.includes(TG_SHOP.secret), false)
})

// ---------- automatic confirm after return (client calls /api/yookassa/confirm) ----------
const confirmWeb = (id: string, headers: Record<string, string>) => post('/api/yookassa/confirm', { paymentId: id }, headers)
const grantedAt = async (id: string) =>
  String((await run(`SELECT premium_granted_at FROM web_payments WHERE id = $1`, [id])).rows[0]?.premium_granted_at)

test('Return confirm before the webhook grants once; the late webhook does not grant again', async () => {
  const buyer = await webBuyer('premium_web_1m')
  const id = String((await createWeb(buyer)).body.paymentId)
  markPaid(id)
  const before = await counts()

  const first = await confirmWeb(id, buyer.headers)
  assert.equal(first.status, 200, JSON.stringify(first.body))
  assert.equal(first.body.ok, true)
  assert.equal(first.body.alreadyDone, false)
  assert.ok(first.body.activeUntil, 'confirm returns the new expiry')
  const stamp = await grantedAt(id)

  assert.equal((await webhook('payment.succeeded', { id, status: 'succeeded' })).status, 200)
  const ent = await webEntitlements(buyer.webAccountId)
  assert.equal(ent.length, 1, 'webhook after confirm does not grant again')
  assert.equal(await grantedAt(id), stamp)

  const after = await counts()
  assert.equal(after.subscriptions, before.subscriptions)
  assert.equal(after.payments, before.payments)
  assert.equal(after.webEntitlements, before.webEntitlements + 1)
})

test('Webhook before the return: confirm reports alreadyDone and keeps a single entitlement', async () => {
  const buyer = await webBuyer('premium_web_1m')
  const id = String((await createWeb(buyer)).body.paymentId)
  markPaid(id)
  assert.equal((await webhook('payment.succeeded', { id, status: 'succeeded' })).status, 200)
  const stamp = await grantedAt(id)
  const until = String((await webEntitlements(buyer.webAccountId))[0]?.active)

  for (let i = 0; i < 3; i += 1) {
    const res = await confirmWeb(id, buyer.headers)
    assert.equal(res.status, 200)
    assert.equal(res.body.ok, true)
    assert.equal(res.body.alreadyDone, true)
    assert.ok(res.body.activeUntil)
  }
  assert.equal((await webEntitlements(buyer.webAccountId)).length, 1)
  assert.equal(await grantedAt(id), stamp)
  assert.equal(until, 'true')
})

test('Pending then succeeded; canceled never grants', async () => {
  const buyer = await webBuyer('premium_web_1m')
  const id = String((await createWeb(buyer)).body.paymentId)
  for (let i = 0; i < 2; i += 1) {
    const res = await confirmWeb(id, buyer.headers)
    assert.equal(res.status, 200)
    assert.equal(res.body.ok, false)
    assert.equal(res.body.status, 'pending')
  }
  assert.equal((await webEntitlements(buyer.webAccountId)).length, 0)
  markPaid(id)
  assert.equal((await confirmWeb(id, buyer.headers)).body.ok, true)
  assert.equal((await webEntitlements(buyer.webAccountId)).length, 1)

  const other = await webBuyer('premium_web_1m')
  const canceledId = String((await createWeb(other)).body.paymentId)
  store.payments.get(canceledId)!.object.status = 'canceled'
  const res = await confirmWeb(canceledId, other.headers)
  assert.equal(res.body.ok, false)
  assert.equal(res.body.status, 'canceled')
  assert.equal((await webEntitlements(other.webAccountId)).length, 0)
})

test('YooKassa API error on confirm: 502, no grant, a later confirm succeeds once', async () => {
  const buyer = await webBuyer('premium_web_1m')
  const id = String((await createWeb(buyer)).body.paymentId)
  markPaid(id)
  providerDown = true
  try {
    const res = await confirmWeb(id, buyer.headers)
    assert.ok(res.status >= 500, `expected a 5xx, got ${res.status}`)
    assert.equal((await webEntitlements(buyer.webAccountId)).length, 0)
  } finally {
    providerDown = false
  }
  assert.equal((await confirmWeb(id, buyer.headers)).body.ok, true)
  assert.equal((await confirmWeb(id, buyer.headers)).body.alreadyDone, true)
  assert.equal((await webEntitlements(buyer.webAccountId)).length, 1)
})

test('Lost session: no cookies or bad CSRF is 401 without a grant; the buyer can still confirm later', async () => {
  const buyer = await webBuyer('premium_web_1m')
  const id = String((await createWeb(buyer)).body.paymentId)
  markPaid(id)
  const anonymous = await confirmWeb(id, {})
  assert.equal(anonymous.status, 401)
  const badCsrf = await confirmWeb(id, { Cookie: buyer.headers.Cookie, 'X-CSRF-Token': 'wrong' })
  assert.equal(badCsrf.status, 401)
  assert.equal((await webEntitlements(buyer.webAccountId)).length, 0)

  const fresh = await webBuyer('premium_web_1m') // new anonymous account after losing the cookie
  const stolen = await confirmWeb(id, fresh.headers)
  assert.equal(stolen.status, 403, 'a different WEB account cannot claim the payment')
  assert.equal((await webEntitlements(fresh.webAccountId)).length, 0)
  assert.equal((await webEntitlements(buyer.webAccountId)).length, 0)

  assert.equal((await confirmWeb(id, buyer.headers)).body.ok, true)
  assert.equal((await webEntitlements(buyer.webAccountId)).length, 1)
})

test('Telegram Mini App confirm is unchanged and cannot claim a WEB payment', async () => {
  const tg = await telegramBuyer(910077)
  const tgId = String((await createTelegram(tg)).body.paymentId)
  markPaid(tgId)
  const tgHeaders = { 'X-Telegram-Init-Data': tg.initData }
  const ok = await confirmWeb(tgId, tgHeaders)
  assert.equal(ok.status, 200, JSON.stringify(ok.body))
  assert.equal(ok.body.ok, true)
  assert.ok(callsFor(tgId).filter((c) => c.method === 'GET').every((c) => c.shop === TG_SHOP.id))
  assert.equal((await confirmWeb(tgId, tgHeaders)).body.alreadyDone, true)
  assert.equal(
    Number((await run(`SELECT count(*)::int AS c FROM subscriptions WHERE telegram_id = 910077`)).rows[0]!.c),
    1
  )

  const buyer = await webBuyer('premium_web_1m')
  const webId = String((await createWeb(buyer)).body.paymentId)
  markPaid(webId)
  const before = await counts()
  const claim = await confirmWeb(webId, tgHeaders)
  assert.equal(claim.body.ok === true, false, 'Telegram caller cannot grant a WEB order')
  const after = await counts()
  assert.equal(after.subscriptions, before.subscriptions)
  assert.equal(after.webEntitlements, before.webEntitlements)
  assert.equal((await webEntitlements(buyer.webAccountId)).length, 0)
})

// ---------- email in profile restores a paid account after a session change ----------
async function rawPost(pathname: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await realFetch(`${baseUrl}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  return {
    status: res.status,
    setCookie: res.headers.getSetCookie?.() ?? [],
    body: (text ? JSON.parse(text) : {}) as Record<string, unknown>,
  }
}

function cookieHeaders(setCookie: string[]) {
  const pick = (name: string) => setCookie.find((c) => c.startsWith(`${name}=`))?.split(';')[0]?.split('=')[1] ?? ''
  const sid = pick(SESSION_COOKIE)
  const csrf = pick(CSRF_COOKIE)
  return { Cookie: `${SESSION_COOKIE}=${sid}; ${CSRF_COOKIE}=${csrf}`, 'X-CSRF-Token': csrf }
}

async function sessionMe(headers: Record<string, string>) {
  const res = await realFetch(`${baseUrl}/api/web/session/me`, { headers })
  return (await res.json()) as {
    webAccountId: string
    email: string | null
    emailVerified: boolean
    receiptEmail: string | null
    premium?: { isPremium: boolean; activeUntil: string | null }
  }
}

async function guestPurchase(planId: string, email: string) {
  const buyer = await webBuyer(planId)
  const created = await post(
    '/api/payments/yookassa/create',
    { planId, offerAcceptanceId: buyer.evidenceId, email },
    buyer.headers
  )
  assert.equal(created.status, 200, JSON.stringify(created.body))
  const paymentId = String(created.body.paymentId)
  markPaid(paymentId)
  assert.equal((await webhook('payment.succeeded', { id: paymentId, status: 'succeeded' })).status, 200)
  const me = await sessionMe(buyer.headers)
  assert.equal(me.premium?.isPremium, true, 'Premium works right away in the paying guest session')
  return { buyer, paymentId, activeUntil: me.premium!.activeUntil! }
}

async function untilOf(paymentId: string) {
  const r = await run(`SELECT active_until FROM web_entitlements WHERE payment_id = $1`, [paymentId])
  return new Date(r.rows[0]!.active_until as Date).toISOString()
}

test('E2E: guest buys twice with a receipt email, new browser confirms it → every purchase in one account', async () => {
  const email = 'returner@example.com'
  const first = await guestPurchase('premium_web_1m', email)
  const second = await guestPurchase('premium_web_3m', 'Returner@Example.com') // another browser, same mailbox
  assert.notEqual(first.buyer.webAccountId, second.buyer.webAccountId)
  assert.equal((await sessionMe(first.buyer.headers)).receiptEmail, email, 'profile can prefill the receipt email')
  const before = await counts()

  const fresh = await webBuyer('premium_web_1m') // new browser: new anonymous account
  assert.equal((await sessionMe(fresh.headers)).premium?.isPremium, false)
  assert.equal((await sessionMe(fresh.headers)).receiptEmail, null)

  const bound = await rawPost('/api/web/email/bind/start', { email }, fresh.headers)
  assert.equal(bound.status, 200, JSON.stringify(bound.body))
  assert.equal(bound.body.mode, 'verify_sent')
  assert.equal('webAccountId' in bound.body, false, 'no account id leaks')
  assert.equal(bound.setCookie.some((c) => c.startsWith(`${SESSION_COOKIE}=`)), false, 'no session from the address alone')
  assert.equal((await sessionMe(fresh.headers)).premium?.isPremium, false, 'nothing before the mailbox is confirmed')
  const unknown = await rawPost('/api/web/email/bind/start', { email: 'someone-new@example.com' }, fresh.headers)
  assert.deepEqual(Object.keys(unknown.body).sort(), Object.keys(bound.body).sort(), 'same answer for unknown email')

  const confirmed = await rawPost('/api/web/email/confirm', { token: bound.body.token })
  assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body))
  assert.equal(confirmed.body.webAccountId, fresh.webAccountId, 'the current guest became the account of this email')
  const main = cookieHeaders(confirmed.setCookie)
  let me = await sessionMe(main)
  assert.equal(me.emailVerified, true)
  assert.equal(me.premium?.isPremium, true)
  assert.equal(me.premium?.activeUntil, second.activeUntil, 'longest of the two purchases, terms not summed')

  // Another device signs into the same account; nothing is granted again.
  const other = await webBuyer('premium_web_1m')
  const otherBind = await rawPost('/api/web/email/bind/start', { email }, other.headers)
  const otherDone = await rawPost('/api/web/email/confirm', { token: otherBind.body.token })
  assert.equal(otherDone.body.webAccountId, fresh.webAccountId)
  assert.deepEqual(await counts(), before, 'no new payments, entitlements or subscriptions')

  // Payment owner checks stay with the paying account.
  const foreign = await post('/api/yookassa/confirm', { paymentId: first.paymentId }, main)
  assert.equal(foreign.body.ok === true && !foreign.body.alreadyDone, false, 'no grant through another account')
  assert.deepEqual(await counts(), before)

  // Full refund of the longer purchase via the webhook: access falls back to the other one.
  store.refunds.set('rf-e2e-1', {
    shop: WEB_SHOP.id,
    object: { id: 'rf-e2e-1', status: 'succeeded', payment_id: second.paymentId, amount: { value: '499.00', currency: 'RUB' } },
  })
  assert.equal((await webhook('refund.succeeded', { id: 'rf-e2e-1', payment_id: second.paymentId, status: 'succeeded' })).status, 200)
  me = await sessionMe(main)
  assert.equal(me.premium?.isPremium, true)
  assert.equal(me.premium?.activeUntil, first.activeUntil)
  assert.equal((await sessionMe(second.buyer.headers)).premium?.isPremium, false, 'refund applies in the paying session too')

  // A new purchase in the main account starts after the Premium it already sees.
  const p = await plan('premium_web_1m')
  const doc = await activeOffer()
  const ev = await run(
    `INSERT INTO web_legal_evidence (subject_web_account_id, action, document_id, document_version, document_sha256,
       context, request_id)
     VALUES ($1::uuid, 'accept_offer', 'offer', $2, $3, $4::jsonb, $5) RETURNING id`,
    [fresh.webAccountId, doc.version, doc.sha256, JSON.stringify({ ...p, currency: 'RUB' }), `web-${++seq}`]
  )
  const created = await post(
    '/api/payments/yookassa/create',
    { planId: p.planId, offerAcceptanceId: Number(ev.rows[0]!.id), email },
    main
  )
  assert.equal(created.status, 200, JSON.stringify(created.body))
  const thirdId = String(created.body.paymentId)
  markPaid(thirdId)
  await webhook('payment.succeeded', { id: thirdId, status: 'succeeded' })
  const expected = new Date(first.activeUntil)
  expected.setUTCDate(expected.getUTCDate() + p.durationDays)
  assert.equal(await untilOf(thirdId), expected.toISOString())
  assert.equal((await sessionMe(main)).premium?.activeUntil, expected.toISOString())
})

test('/login with a receipt email typed by mistake: the mailbox owner gets the Premium, never the payer session', async () => {
  const email = 'mistaken-b@example.com'
  const a = await guestPurchase('premium_web_1m', email)
  const meA = await sessionMe(a.buyer.headers)
  const before = await counts()

  // B opens /login in a browser without cookies.
  const start = await rawPost('/api/web/email/recover/start', { email })
  assert.equal(start.status, 200, JSON.stringify(start.body))
  const unknown = await rawPost('/api/web/email/recover/start', { email: 'nobody-b@example.com' })
  assert.deepEqual(Object.keys(unknown.body).sort(), Object.keys(start.body).sort(), 'same answer for unknown email')
  assert.equal(start.setCookie.some((c) => c.startsWith(`${SESSION_COOKIE}=`)), false)

  const done = await rawPost('/api/web/email/confirm', { token: start.body.token })
  assert.equal(done.status, 200, JSON.stringify(done.body))
  assert.notEqual(done.body.webAccountId, a.buyer.webAccountId, "B never receives A's guest session")
  const b = cookieHeaders(done.setCookie)
  const meB = await sessionMe(b)
  assert.notEqual(meB.webAccountId, a.buyer.webAccountId)
  assert.equal(meB.emailVerified, true)
  assert.equal(meB.premium?.isPremium, true, 'Premium paid with the confirmed email')
  assert.equal(meB.premium?.activeUntil, a.activeUntil)
  assert.equal(meB.receiptEmail ?? null, null)

  // A is untouched; B cannot act on A's payment.
  const meAAfter = await sessionMe(a.buyer.headers)
  assert.equal(meAAfter.webAccountId, meA.webAccountId)
  assert.equal(meAAfter.emailVerified, meA.emailVerified)
  assert.equal(meAAfter.email, meA.email)
  assert.deepEqual(meAAfter.premium, meA.premium)
  assert.deepEqual(await counts(), before, 'no payments or entitlements created or moved')
  const foreign = await post('/api/yookassa/confirm', { paymentId: a.paymentId }, b)
  assert.equal(foreign.status, 403)

  // B signs in again later: the same confirmed account.
  const again = await rawPost('/api/web/email/recover/start', { email })
  const doneAgain = await rawPost('/api/web/email/confirm', { token: again.body.token })
  assert.equal(doneAgain.body.webAccountId, meB.webAccountId)

  // A session cookie without its CSRF header is ignored; with it, the caller's own guest is confirmed.
  const c = await webBuyer('premium_web_1m')
  const noCsrf = await rawPost('/api/web/email/recover/start', { email: 'c-own@example.com' }, { Cookie: c.headers.Cookie })
  const noCsrfDone = await rawPost('/api/web/email/confirm', { token: noCsrf.body.token })
  assert.notEqual(noCsrfDone.body.webAccountId, c.webAccountId)
  const withCsrf = await rawPost('/api/web/email/recover/start', { email: 'c-own2@example.com' }, c.headers)
  const withCsrfDone = await rawPost('/api/web/email/confirm', { token: withCsrf.body.token })
  assert.equal(withCsrfDone.body.webAccountId, c.webAccountId)
})