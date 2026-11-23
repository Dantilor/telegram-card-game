import { expect, test } from '@playwright/test'
import { BASE_URL } from './helpers'

/**
 * Mocked UI E2E for Profile device slots.
 * Backend limit enforcement: server webTelegramDevices PGlite tests.
 *
 * Original failure causes (both fixed):
 * 1) GNH_E2E_BASE_URL pointed at stale preview :4174 while Vite started on :5173.
 * 2) Broad page.route matching /api/ also matched Vite modules under src/api
 *    and returned JSON, blanking the React app (MIME type error).
 */

type DeviceRow = {
  id: string
  label: string
  linkedAt: string
  lastActiveAt: string
  isCurrent: boolean
  isLegacy: boolean
}

const CURRENT: DeviceRow = {
  id: '11111111-1111-1111-1111-111111111111',
  label: 'Chrome on this PC',
  linkedAt: '2026-01-01T00:00:00.000Z',
  lastActiveAt: '2026-01-02T00:00:00.000Z',
  isCurrent: true,
  isLegacy: false,
}

const OTHER: DeviceRow = {
  id: '22222222-2222-2222-2222-222222222222',
  label: 'Other browser',
  linkedAt: '2026-01-01T00:00:00.000Z',
  lastActiveAt: '2026-01-01T12:00:00.000Z',
  isCurrent: false,
  isLegacy: false,
}

async function stubWebShell(
  page: import('@playwright/test').Page,
  opts: {
    linked: boolean
    lastErrorCode?: string | null
    devices?: DeviceRow[]
    logoutStatus?: number
    statusHook?: (n: number) => { lastErrorCode?: string | null }
  }
) {
  const devices = opts.devices ?? [CURRENT, OTHER]
  let statusCalls = 0

  await page.route('**/api/premium-status**', async (route) => {
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
    const path = new URL(route.request().url()).pathname
    if (!path.startsWith('/api/me')) {
      await route.fallback()
      return
    }
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
        telegramId: null,
      }),
    })
  })
  await page.route('**/api/web/telegram-link/status', async (route) => {
    statusCalls += 1
    const hook = opts.statusHook?.(statusCalls)
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
        devicesUsed: opts.linked ? devices.length : 0,
        devicesLimit: 3,
        lastErrorCode: hook?.lastErrorCode ?? opts.lastErrorCode ?? null,
      }),
    })
  })
  await page.route('**/api/web/telegram-devices', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        linked: true,
        devicesUsed: devices.length,
        devicesLimit: 3,
        devices,
      }),
    })
  })
  await page.route('**/api/web/telegram-devices/logout-current', async (route) => {
    const status = opts.logoutStatus ?? 200
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(
        status >= 400
          ? { ok: false, error: 'logout failed', code: 'device_logout_failed' }
          : { ok: true, devicesUsed: Math.max(0, devices.length - 1), devicesLimit: 3 }
      ),
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
}

async function openProfile(page: import('@playwright/test').Page) {
  await page.goto(`${BASE_URL}/profile`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('html[data-gnh-shell="web"]')).toHaveCount(1)
  await expect(page.getByText('GameNight Host').first()).toBeVisible({ timeout: 30_000 })
  const dismiss = page.getByRole('button', { name: /Понятно|Закрыть/i })
  if (await dismiss.count()) {
    await dismiss.first().click({ timeout: 2000 }).catch(() => undefined)
  }
}

test.describe('WEB profile telegram devices (mocked UI)', () => {
  test('shows devices block when Telegram is linked', async ({ page }) => {
    await stubWebShell(page, { linked: true })
    await openProfile(page)

    await expect(page.getByText(/Telegram подключён/i).first()).toBeVisible({ timeout: 20_000 })
    const block = page.getByTestId('profile-devices')
    await expect(block).toBeVisible({ timeout: 20_000 })
    await expect(block.getByRole('heading', { name: 'Мои устройства' })).toBeVisible()
    await expect(block.getByText(/2 из 3/)).toBeVisible()
    await expect(block.getByText('Это устройство')).toBeVisible()
    await expect(block.getByRole('button', { name: 'Выйти на этом устройстве' })).toBeVisible()
    await expect(block.getByRole('button', { name: 'Отключить' })).toBeVisible()
  })

  test('logout failure does not claim success', async ({ page }) => {
    await stubWebShell(page, { linked: true, logoutStatus: 500 })
    await openProfile(page)
    const block = page.getByTestId('profile-devices')
    await expect(block).toBeVisible({ timeout: 20_000 })
    page.once('dialog', async (dialog) => {
      await dialog.accept()
    })
    await block.getByRole('button', { name: 'Выйти на этом устройстве' }).click()
    await expect(
      page.getByText(/Не удалось выйти на этом устройстве|Слот не освобождён/i)
    ).toBeVisible({ timeout: 10_000 })
    await expect(page).toHaveURL(/\/profile/)
  })

  test('restore polling surfaces device_limit_reached', async ({ page }) => {
    await stubWebShell(page, {
      linked: false,
      statusHook: (n) => ({ lastErrorCode: n >= 2 ? 'device_limit_reached' : null }),
    })
    await openProfile(page)
    const restore = page.getByRole('button', { name: /Восстановить через Telegram/i })
    await expect(restore).toBeVisible({ timeout: 20_000 })
    await restore.click()
    await expect(page.getByText(/Все 3 устройства уже подключены/i)).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('link', { name: /Каталог|GameNight Host/i }).first()).toBeVisible()
  })
})
