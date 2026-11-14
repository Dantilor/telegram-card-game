import { test, expect } from '@playwright/test'
import {
  BASE_URL,
  DEV_SECRET,
  USERS,
  apiGet,
  apiPost,
  devLogin,
  expectSessionCookies,
  isPremiumPayload,
  readCsrf,
} from './helpers'

test.describe('WEB auth (dev-login)', () => {
  test('login screen, session cookies, me endpoints, reload, logout', async ({ page, context }) => {
    await page.goto(`${BASE_URL}/login`)
    await expect(page.getByRole('button', { name: /Войти через Telegram/i })).toBeVisible()

    const login = await page.request.post(`${BASE_URL}/api/web/auth/dev-login`, {
      data: {
        telegramId: USERS.premium1m,
        secret: DEV_SECRET,
        displayName: 'E2E Host',
      },
    })
    expect(login.ok()).toBeTruthy()
    await expectSessionCookies(context)

    await page.goto(`${BASE_URL}/`)
    await expect(page.getByText('GameNight Host').first()).toBeVisible()

    const sessionMe = await apiGet(page.request, '/api/web/session/me')
    expect(sessionMe.ok()).toBeTruthy()
    const sessionJson = await sessionMe.json()
    expect(sessionJson.telegramId).toBe(USERS.premium1m)

    const me = await apiGet(page.request, '/api/me')
    expect(me.ok()).toBeTruthy()

    const premium = await apiGet(page.request, '/api/premium-status')
    expect(premium.ok()).toBeTruthy()
    const premiumJson = await premium.json()
    expect(isPremiumPayload(premiumJson)).toBeTruthy()

    await page.reload()
    await expect(page.getByText('GameNight Host').first()).toBeVisible()
    await expectSessionCookies(context)

    const csrf = await readCsrf(context)
    const logout = await apiPost(page.request, '/api/web/auth/logout', {}, csrf)
    expect(logout.ok()).toBeTruthy()

    await page.goto(`${BASE_URL}/`)
    await expect(page.getByRole('button', { name: /Войти через Telegram/i })).toBeVisible({
      timeout: 15_000,
    })
  })

  test('dev-login rejected without secret', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/web/auth/dev-login`, {
      data: { telegramId: USERS.free, secret: 'wrong-secret-xx', displayName: 'Nope' },
    })
    expect(res.status()).toBe(401)
  })

  test('unauthenticated /api/me is 401', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/me`)
    expect(res.status()).toBe(401)
  })
})

test.describe('seeded premium users', () => {
  test('free / 1m / lifetime / expired premium-status', async ({ browser }) => {
    const cases: Array<{ id: number; expectActive: boolean }> = [
      { id: USERS.free, expectActive: false },
      { id: USERS.premium1m, expectActive: true },
      { id: USERS.lifetime, expectActive: true },
      { id: USERS.expired, expectActive: false },
    ]
    for (const c of cases) {
      const ctx = await browser.newContext()
      const page = await ctx.newPage()
      await devLogin(page, c.id, `User ${c.id}`)
      const premium = await apiGet(page.request, '/api/premium-status')
      expect(premium.ok(), `premium-status ${c.id}`).toBeTruthy()
      const body = await premium.json()
      const active = isPremiumPayload(body)
      expect(active, `user ${c.id} active=${active} body=${JSON.stringify(body)}`).toBe(c.expectActive)
      await ctx.close()
    }
  })
})
