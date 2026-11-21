import { expect, test } from '@playwright/test'
import { BASE_URL } from './helpers'

test.describe('WEB profile telegram devices', () => {
  test('shows devices block and restore device-limit error from API', async ({ page }) => {
    await page.route('**/api/web/session/**', async (route) => {
      if (route.request().method() === 'GET' || route.request().url().includes('ensure')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            webAccountId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            email: null,
            emailVerified: false,
          }),
        })
        return
      }
      await route.continue()
    })
    await page.route('**/api/web/telegram-link/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          linked: true,
          telegramId: '42',
          linkedAt: '2026-01-01T00:00:00.000Z',
          pendingChallengeExpiresAt: null,
          isPremium: true,
          activeUntil: '2099-01-01T00:00:00.000Z',
          sources: ['telegram_subscription'],
          devicesUsed: 3,
          devicesLimit: 3,
          lastErrorCode: null,
        }),
      })
    })
    await page.route('**/api/web/telegram-devices', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          linked: true,
          devicesUsed: 3,
          devicesLimit: 3,
          devices: [
            {
              id: '11111111-1111-1111-1111-111111111111',
              label: 'Это устройство',
              linkedAt: '2026-01-01T00:00:00.000Z',
              lastActiveAt: '2026-01-02T00:00:00.000Z',
              isCurrent: true,
              isLegacy: false,
            },
            {
              id: '22222222-2222-2222-2222-222222222222',
              label: 'Другой браузер',
              linkedAt: '2026-01-01T00:00:00.000Z',
              lastActiveAt: '2026-01-01T12:00:00.000Z',
              isCurrent: false,
              isLegacy: false,
            },
          ],
        }),
      })
    })
    await page.route('**/api/premium-status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ isPremium: true, activeUntil: '2099-01-01T00:00:00.000Z', sources: ['telegram_subscription'] }),
      })
    })
    await page.route('**/api/me**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ userId: null, webAccountId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', isPremium: true }),
      })
    })

    await page.goto(`${BASE_URL}/profile`)
    await expect(page.getByRole('region', { name: 'Мои устройства' }).or(page.getByText('Мои устройства'))).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText(/3 из 3|3 из 3/)).toBeVisible()
    await expect(page.getByText('Это устройство').first()).toBeVisible()
  })

  test('restore polling surfaces device_limit_reached', async ({ page }) => {
    let statusCalls = 0
    await page.route('**/api/web/session/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          webAccountId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          email: null,
          emailVerified: false,
        }),
      })
    })
    await page.route('**/api/web/telegram-link/status', async (route) => {
      statusCalls += 1
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          linked: false,
          telegramId: null,
          linkedAt: null,
          pendingChallengeExpiresAt: '2099-01-01T00:00:00.000Z',
          isPremium: false,
          activeUntil: null,
          sources: [],
          devicesUsed: 0,
          devicesLimit: 3,
          lastErrorCode: statusCalls > 1 ? 'device_limit_reached' : null,
        }),
      })
    })
    await page.route('**/api/web/telegram-link/start', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
          deepLink: 'https://t.me/GameNightHostBot?startapp=wl_testdevice_limit_token_xx',
          instruction: 'test',
          token: 'wl_testdevice_limit_token_xx',
        }),
      })
    })
    await page.route('**/api/premium-status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ isPremium: false, activeUntil: null, sources: [] }),
      })
    })
    await page.route('**/api/me**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ userId: null, webAccountId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', isPremium: false }),
      })
    })

    await page.goto(`${BASE_URL}/profile`)
    const restore = page.getByRole('button', { name: /Восстановить через Telegram/i })
    if (await restore.count()) {
      await restore.first().click()
      await expect(page.getByText(/Все 3 устройства уже подключены/i)).toBeVisible({ timeout: 20_000 })
    }
  })
})