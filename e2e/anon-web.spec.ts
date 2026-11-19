import { expect, test } from '@playwright/test'
import { BASE_URL, expectSessionCookies } from './helpers'

test.describe('Anonymous WEB (no registration)', () => {
  test('first visit lands on Home and creates WEB session cookie', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto(`${BASE_URL}/`)
    await expect(page.getByText('GameNight Host').first()).toBeVisible({ timeout: 30_000 })
    // Must not force Telegram login gate
    await expect(page.getByRole('button', { name: /Войти через Telegram/i })).toHaveCount(0)

    await expect.poll(async () => {
      const cookies = await context.cookies()
      return cookies.some((c) => c.name === 'gnh_sid')
    }).toBeTruthy()

    const me = await page.request.get(`${BASE_URL}/api/web/session/me`)
    expect(me.ok()).toBeTruthy()
    const json = await me.json()
    expect(json.webAccountId || json.telegramId).toBeTruthy()
    expect(json.source === 'web_account' || json.source === 'web_session').toBeTruthy()
  })

  test('reload keeps anonymous session', async ({ page, context }) => {
    await page.goto(`${BASE_URL}/`)
    await expect(page.getByText('GameNight Host').first()).toBeVisible({ timeout: 30_000 })
    await expect
      .poll(async () => (await context.cookies()).some((c) => c.name === 'gnh_sid' && c.httpOnly))
      .toBeTruthy()
    await expectSessionCookies(context)
    const before = await (await page.request.get(`${BASE_URL}/api/web/session/me`)).json()
    expect(before.webAccountId || before.telegramId).toBeTruthy()
    await page.reload()
    await expect(page.getByText('GameNight Host').first()).toBeVisible()
    const after = await (await page.request.get(`${BASE_URL}/api/web/session/me`)).json()
    if (before.webAccountId) {
      expect(after.webAccountId).toBe(before.webAccountId)
    }
  })

  test('free catalog path stays open without Telegram login', async ({ page }) => {
    await page.goto(`${BASE_URL}/games`)
    await expect(page.getByText(/игр|каталог|GameNight/i).first()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('button', { name: /Войти через Telegram/i })).toHaveCount(0)
  })
})
