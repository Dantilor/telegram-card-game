import { expect, test } from '@playwright/test'
import { BASE_URL } from './helpers'

async function stubWebShell(page: import('@playwright/test').Page, opts: {
  linked: boolean
  lastErrorCode?: string | null
  devices?: unknown[]
}) {
  await page.route('**/api/web/session/ensure', async (route) => {
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
  })
  await page.route('**/api/web/session/me', async (route) => {
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
  })
  await page.route('**/api/web/telegram-link/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        linked: opts.linked,
        telegramId: opts.linked ? '42' : null,
        linkedAt: opts.linked ? '2026-01-01T00:00:00.000Z' : null,
        pendingChallengeExpiresAt: opts.linked ? null : '2099-01-01T00:00:00.000Z',
        isPremium: opts.linked,
        activeUntil: opts.linked ? '2099-01-01T00:00:00.000Z' : null,
        sources: opts.linked ? ['telegram_subscription'] : [],
        devicesUsed: opts.linked ? 3 : 0,
        devicesLimit: 3,
        lastErrorCode: opts.lastErrorCode ?? null,
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
        devices: opts.devices ?? [
          {
            id: '11111111-1111-1111-1111-111111111111',
            label: 'Chrome on this PC',
            linkedAt: '2026-01-01T00:00:00.000Z',
            lastActiveAt: '2026-01-02T00:00:00.000Z',
            isCurrent: true,
            isLegacy: false,
          },
          {
            id: '22222222-2222-2222-2222-222222222222',
            label: 'Other browser',
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
      body: JSON.stringify({
        isPremium: opts.linked,
        activeUntil: opts.linked ? '2099-01-01T00:00:00.000Z' : null,
        sources: opts.linked ? ['telegram_subscription'] : [],
      }),
    })
  })
  await page.route('**/api/me**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        userId: null,
        webAccountId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        isPremium: opts.linked,
      }),
    })
  })
}

test.describe('WEB profile telegram devices', () => {
  test('shows devices block when Telegram is linked', async ({ page }) => {
    await stubWebShell(page, { linked: true })
    await page.goto(`${BASE_URL}/profile`)
    await expect(page.getByTestId('profile-devices')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('profile-devices').getByText('Мои устройства')).toBeVisible()
    await expect(page.getByText(/3 из 3/)).toBeVisible()
    await expect(page.getByText('Это устройство').first()).toBeVisible()
  })

  test('restore polling surfaces device_limit_reached', async ({ page }) => {
    let statusCalls = 0
    await stubWebShell(page, { linked: false, lastErrorCode: null })
    await page.unroute('**/api/web/telegram-link/status')
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

    await page.goto(`${BASE_URL}/profile`)
    const restore = page.getByRole('button', { name: /Восстановить через Telegram/i })
    await expect(restore).toBeVisible({ timeout: 20_000 })
    await restore.click()
    await expect(page.getByText(/Все 3 устройства уже подключены/i)).toBeVisible({ timeout: 25_000 })
  })
})
