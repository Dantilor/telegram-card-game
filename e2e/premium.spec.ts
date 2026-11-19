import { test, expect } from '@playwright/test'
import { API_URL, DEV_SECRET, isPremiumPayload } from './helpers'

test.describe('Premium mock YooKassa', () => {
  test('create mock payment, return_url alone does not grant, webhook grants', async ({
    playwright,
  }) => {
    const api = await playwright.request.newContext({ baseURL: API_URL })
    // Fresh telegram buyer each run so leftover local subscriptions do not flake the pretest.
    const buyerTelegramId = 910_000 + (Date.now() % 50_000)
    const login = await api.post('/api/web/auth/dev-login', {
      data: {
        telegramId: buyerTelegramId,
        secret: DEV_SECRET,
        displayName: 'E2E Free Buyer',
      },
    })
    expect(login.ok(), await login.text()).toBeTruthy()
    const csrf = (await api.storageState()).cookies.find((c) => c.name === 'gnh_csrf')?.value
    expect(csrf).toBeTruthy()

    const offerDoc = await api.get('/api/legal/documents/offer')
    expect(offerDoc.ok(), `offer ${offerDoc.status()}`).toBeTruthy()
    const offer = await offerDoc.json()

    const accept = await api.post('/api/legal/offer-acceptances', {
      headers: { 'X-CSRF-Token': csrf! },
      data: {
        requestId: `e2e-offer-${Date.now()}`,
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
    const acceptBody = await accept.json()
    const evidenceId = acceptBody.evidenceId ?? acceptBody.id
    expect(evidenceId).toBeTruthy()

    const create = await api.post('/api/payments/yookassa/create', {
      headers: { 'X-CSRF-Token': csrf! },
      data: {
        planId: 'premium_1m',
        email: 'e2e.buyer@example.test',
        offerAcceptanceId: evidenceId,
      },
    })
    expect(create.ok(), await create.text()).toBeTruthy()
    const created = await create.json()
    expect(created.paymentId).toMatch(/^mock_/)
    expect(String(created.confirmationUrl)).toContain('payment=return')
    expect(created.mock).toBe(true)

    const confirmEarly = await api.post('/api/yookassa/confirm', {
      headers: { 'X-CSRF-Token': csrf! },
      data: { paymentId: created.paymentId },
    })
    expect(confirmEarly.ok()).toBeTruthy()
    const earlyBody = await confirmEarly.json()
    expect(earlyBody.ok).toBeFalsy()

    const before = await api.get('/api/premium-status')
    expect(isPremiumPayload(await before.json())).toBe(false)

    // Standard YooKassa notifications have no Authorization Bearer.
    const webhook = await api.post('/api/yookassa/webhook', {
      data: {
        event: 'payment.succeeded',
        object: {
          id: created.paymentId,
          status: 'succeeded',
          metadata: {
            telegram_id: String(buyerTelegramId),
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

    await api.dispose()
  })
})
