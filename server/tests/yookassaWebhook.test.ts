import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

const mocks = vi.hoisted(() => ({ query: vi.fn(), grant: vi.fn(), ensureUser: vi.fn(), log: vi.fn(), duration: vi.fn() }))
vi.mock('../src/db.js', () => ({ query: mocks.query }))
vi.mock('../src/services/subscriptions.js', () => ({
  ensureUser: mocks.ensureUser, extendPremiumActiveUntil: mocks.grant, logPgError: mocks.log,
}))
vi.mock('../src/services/plans.js', () => ({
  getActivePlanById: vi.fn(), getPlanDurationDays: mocks.duration, planReceiptDescription: vi.fn(),
}))
import router from '../src/routes/yookassa.js'
const realFetch = globalThis.fetch
let server: Server
let url: string
const pid = '2abcde12-0000-5000-8000-123456789abc'
const row = { id: 1, telegram_id: '12345', plan_id: 'premium_1m', total_amount: 259, currency: 'RUB', status: 'pending', premium_granted_at: null }
const validPayment = () => ({ id: pid, status: 'succeeded', paid: true, amount: { value: '259.00', currency: 'RUB' }, metadata: { telegram_id: '12345', plan_id: 'premium_1m' } })
let provider: ReturnType<typeof vi.fn>
async function notify(body: unknown = { event: 'payment.succeeded', object: { id: pid, metadata: { telegram_id: '99999' } } }) {
  return realFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use('/api', router)
  await new Promise<void>(resolve => { server = app.listen(0, '127.0.0.1', resolve) })
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/yookassa/webhook`
})
afterAll(async () => {
  vi.unstubAllGlobals(); vi.unstubAllEnvs()
  await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()))
})
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('YOOKASSA_SHOP_ID', 'test-shop'); vi.stubEnv('YOOKASSA_SECRET_KEY', 'test-key')
  vi.stubEnv('YOOKASSA_WEBHOOK_SECRET', 'legacy-secret-still-present')
  provider = vi.fn().mockResolvedValue(new Response(JSON.stringify(validPayment()), { status: 200 }))
  vi.stubGlobal('fetch', provider)
  mocks.query.mockResolvedValue({ rows: [{ ...row }] })
  mocks.duration.mockResolvedValue(30)
  mocks.grant.mockResolvedValue(new Date('2027-01-01T00:00:00Z'))
})
describe('YooKassa webhook verification', () => {
  it('accepts a genuine paid payment without Bearer even with the legacy secret set; ignores forged body metadata', async () => {
    expect((await notify()).status).toBe(200)
    expect(provider).toHaveBeenCalledWith(`https://api.yookassa.ru/v3/payments/${pid}`, expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(mocks.grant).toHaveBeenCalledWith('12345', 'premium_1m', 30)
  })
  it.each([
    ['unpaid', { ...validPayment(), paid: false }],
    ['wrong id', { ...validPayment(), id: 'another-id' }],
    ['underpaid', { ...validPayment(), amount: { value: '1.00', currency: 'RUB' } }],
    ['wrong currency', { ...validPayment(), amount: { value: '259.00', currency: 'USD' } }],
    ['wrong customer', { ...validPayment(), metadata: { telegram_id: '99999', plan_id: 'premium_1m' } }],
    ['wrong plan', { ...validPayment(), metadata: { telegram_id: '12345', plan_id: 'lifetime' } }],
  ])('does not grant for %s', async (_name, payment) => {
    provider.mockResolvedValue(new Response(JSON.stringify(payment)))
    expect((await notify()).status).toBe(200)
    expect(mocks.grant).not.toHaveBeenCalled()
  })
  it('returns 503 if the provider is down, allowing notification retry', async () => {
    provider.mockResolvedValue(new Response('', { status: 500 }))
    expect((await notify()).status).toBe(503); expect(mocks.grant).not.toHaveBeenCalled()
  })
  it('retries when notification arrives before local payment insertion', async () => {
    mocks.query.mockResolvedValue({ rows: [] })
    expect((await notify()).status).toBe(503); expect(mocks.grant).not.toHaveBeenCalled()
  })
  it('retries database failures instead of acknowledging lost work', async () => {
    mocks.query.mockRejectedValue(new Error('DB unavailable'))
    expect((await notify()).status).toBe(503)
  })
  it('does not grant a duplicate notification twice', async () => {
    mocks.query.mockResolvedValue({ rows: [{ ...row, premium_granted_at: new Date() }] })
    expect((await notify()).status).toBe(200); expect(mocks.grant).not.toHaveBeenCalled()
  })
  it('uses the provider current status rather than a forged succeeded event', async () => {
    provider.mockResolvedValue(new Response(JSON.stringify({ ...validPayment(), status: 'canceled', paid: false })))
    expect((await notify()).status).toBe(200); expect(mocks.grant).not.toHaveBeenCalled()
    expect(mocks.query).toHaveBeenLastCalledWith(expect.stringContaining("status <> 'succeeded'"), ['canceled', pid])
  })
  it('rejects invalid ids without querying the provider', async () => {
    expect((await notify({ event: 'payment.succeeded', object: { id: '../bad' } })).status).toBe(400)
    expect(provider).not.toHaveBeenCalled()
  })
  it('ignores unrelated events', async () => {
    expect((await notify({ event: 'refund.succeeded', object: { id: pid } })).status).toBe(200)
    expect(provider).not.toHaveBeenCalled()
  })
})
