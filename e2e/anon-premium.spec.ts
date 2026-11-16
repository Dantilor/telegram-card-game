import { expect, test } from '@playwright/test'
import { API_URL, DEV_SECRET, USERS, isPremiumPayload } from './helpers'

test.describe('Anonymous WEB Premium', () => {
  test('mock WEB purchase grants premium; webhook is idempotent', async ({ playwright }) => {
    const api = await playwright.request.newContext({ baseURL: API_URL })

    const ensure = await api.post('/api/web/session/ensure')
    expect(ensure.ok(), await ensure.text()).toBeTruthy()
    const ensured = await ensure.json()
    expect(ensured.webAccountId).toBeTruthy()

    const csrf = (await api.storageState()).cookies.find((c) => c.name === 'gnh_csrf')?.value
    expect(csrf).toBeTruthy()

    const before = await api.get('/api/premium-status')
    expect(before.ok()).toBeTruthy()
    expect(isPremiumPayload(await before.json())).toBe(false)

    const createBlocked = await api.post('/api/payments/yookassa/create', {
      headers: { 'X-CSRF-Token': csrf! },
      data: {
        planId: 'premium_1m',
        email: 'anon.buyer@example.test',
      },
    })
    expect(createBlocked.ok()).toBeFalsy()

    const offerDoc = await api.get('/api/legal/documents/offer')
    expect(offerDoc.ok(), `offer ${offerDoc.status()}`).toBeTruthy()
    const offer = await offerDoc.json()
    const accept = await api.post('/api/legal/offer-acceptances', {
      headers: { 'X-CSRF-Token': csrf! },
      data: {
        requestId: `e2e-anon-offer-${Date.now()}`,
        planId: 'premium_1m',
        priceRub: 259,
        durationDays: 30,
        currency: 'RUB',
        statement: 'Принимаю Публичную оферту Premium',
        version: offer.version,
        sha256: offer.sha256,
      },
    })
    expect(accept.ok(), await accept.text()).toBeTruthy()
    const evidenceId = (await accept.json()).evidenceId
    expect(evidenceId).toBeTruthy()

    const create = await api.post('/api/payments/yookassa/create', {
      headers: { 'X-CSRF-Token': csrf! },
      data: {
        planId: 'premium_1m',
        email: 'anon.buyer@example.test',
        offerAcceptanceId: evidenceId,
      },
    })
    expect(create.ok(), await create.text()).toBeTruthy()
    const created = await create.json()
    expect(created.paymentId).toMatch(/^mock_web_/)
    expect(created.webAccount).toBe(true)

    const confirmEarly = await api.post('/api/yookassa/confirm', {
      headers: { 'X-CSRF-Token': csrf! },
      data: { paymentId: created.paymentId },
    })
    expect(confirmEarly.ok()).toBeTruthy()
    expect((await confirmEarly.json()).ok).toBeFalsy()

    const webhook = await api.post('/api/yookassa/webhook', {
      headers: {
        Authorization: `Bearer ${process.env.YOOKASSA_WEBHOOK_SECRET || 'local-mock-webhook'}`,
      },
      data: {
        event: 'payment.succeeded',
        object: {
          id: created.paymentId,
          status: 'succeeded',
          amount: { value: '259.00', currency: 'RUB' },
          metadata: {
            web_account_id: ensured.webAccountId,
            plan_id: 'premium_1m',
          },
        },
      },
    })
    expect(webhook.ok()).toBeTruthy()

    await expect
      .poll(
        async () => {
          const p = await api.get('/api/premium-status')
          return isPremiumPayload(await p.json())
        },
        { timeout: 10_000 }
      )
      .toBe(true)

    const confirmLate = await api.post('/api/yookassa/confirm', {
      headers: { 'X-CSRF-Token': csrf! },
      data: { paymentId: created.paymentId },
    })
    expect(confirmLate.ok()).toBeTruthy()
    const lateBody = await confirmLate.json()
    expect(lateBody.ok).toBeTruthy()
    expect(lateBody.alreadyDone === true || lateBody.webAccountId).toBeTruthy()

    const webhook2 = await api.post('/api/yookassa/webhook', {
      headers: {
        Authorization: `Bearer ${process.env.YOOKASSA_WEBHOOK_SECRET || 'local-mock-webhook'}`,
      },
      data: {
        event: 'payment.succeeded',
        object: {
          id: created.paymentId,
          status: 'succeeded',
          amount: { value: '259.00', currency: 'RUB' },
          metadata: {
            web_account_id: ensured.webAccountId,
            plan_id: 'premium_1m',
          },
        },
      },
    })
    expect(webhook2.ok()).toBeTruthy()

    await api.dispose()
  })

  test('email bind + recover restores WEB account session', async ({ playwright }) => {
    const api = await playwright.request.newContext({ baseURL: API_URL })
    const ensure = await api.post('/api/web/session/ensure')
    expect(ensure.ok()).toBeTruthy()
    const { webAccountId } = await ensure.json()
    expect(webAccountId).toBeTruthy()
    const csrf = (await api.storageState()).cookies.find((c) => c.name === 'gnh_csrf')?.value

    const email = `e2e.recover.${Date.now()}@example.test`
    const start = await api.post('/api/web/email/bind/start', {
      headers: { 'X-CSRF-Token': csrf! },
      data: { email },
    })
    expect(start.ok(), await start.text()).toBeTruthy()
    const started = await start.json()
    expect(started.code).toMatch(/^\d{8}$/)

    const verify = await api.post('/api/web/email/bind/verify', {
      headers: { 'X-CSRF-Token': csrf! },
      data: { email, code: started.code },
    })
    expect(verify.ok(), await verify.text()).toBeTruthy()

    // New browser context = lost cookies
    const api2 = await playwright.request.newContext({ baseURL: API_URL })
    const recoverStart = await api2.post('/api/web/email/recover/start', {
      data: { email },
    })
    expect(recoverStart.ok()).toBeTruthy()
    const recoverBody = await recoverStart.json()
    expect(recoverBody.code).toMatch(/^\d{8}$/)

    const complete = await api2.post('/api/web/email/recover/complete', {
      data: { email, code: recoverBody.code },
    })
    expect(complete.ok(), await complete.text()).toBeTruthy()
    const recovered = await complete.json()
    expect(recovered.webAccountId).toBe(webAccountId)

    const me = await api2.get('/api/web/session/me')
    expect(me.ok()).toBeTruthy()
    expect((await me.json()).webAccountId).toBe(webAccountId)

    await api.dispose()
    await api2.dispose()
  })

  test('telegram link mock restores premium from staging subscription', async ({ playwright }) => {
    const api = await playwright.request.newContext({ baseURL: API_URL })
    const ensure = await api.post('/api/web/session/ensure')
    expect(ensure.ok()).toBeTruthy()
    const csrf = (await api.storageState()).cookies.find((c) => c.name === 'gnh_csrf')?.value

    const start = await api.post('/api/web/telegram-link/start', {
      headers: { 'X-CSRF-Token': csrf! },
    })
    expect(start.ok(), await start.text()).toBeTruthy()
    const { code } = await start.json()
    expect(code).toMatch(/^\d{8}$/)

    const complete = await api.post('/api/web/telegram-link/complete-mock', {
      data: {
        code,
        telegramId: USERS.premium1m,
        secret: DEV_SECRET,
      },
    })
    expect(complete.ok(), await complete.text()).toBeTruthy()
    const body = await complete.json()
    expect(body.linked).toBe(true)

    await expect
      .poll(async () => isPremiumPayload(await (await api.get('/api/premium-status')).json()), {
        timeout: 10_000,
      })
      .toBe(true)

    await api.dispose()
  })
})
