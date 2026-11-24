import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'

const WIDTHS = [375, 390, 768, 1024, 1440, 1920] as const

async function assertNoHorizontalOverflow(page: Page) {
  const overflowX = await page.evaluate(() => {
    const doc = document.documentElement
    const body = document.body
    return Math.max(doc.scrollWidth, body.scrollWidth) > Math.max(doc.clientWidth, body.clientWidth) + 1
  })
  expect(overflowX).toBe(false)
}

async function waitForHomeReady(page: Page) {
  // WEB home is the marketing reference shell (gnh-home-*), not legacy .home-page.
  await expect(page.locator('.gnh-home-ref, .home-page').first()).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('link', { name: /Начать игру/i }).first()).toBeVisible({ timeout: 30_000 })
}

/** Desktop WEB uses a wide shell (up to ~1440px), not a phone column. */
async function assertWideDesktopShell(page: Page, width: number) {
  if (width < 1024) return
  const metrics = await page.evaluate(() => {
    const app = document.querySelector('.app.app--web') as HTMLElement | null
    // Content column is capped (~1440); outer .gnh-home-ref may be full-bleed.
    const home =
      (document.querySelector('.gnh-home-ref .wrap') as HTMLElement | null) ||
      (document.querySelector('.gnh-home-ref') as HTMLElement | null) ||
      (document.querySelector('.home-page') as HTMLElement | null)
    return {
      appWidth: app?.getBoundingClientRect().width ?? 0,
      homeWidth: home?.getBoundingClientRect().width ?? 0,
      viewport: window.innerWidth,
    }
  })
  expect(metrics.appWidth).toBeGreaterThan(700)
  expect(metrics.homeWidth).toBeGreaterThan(700)
  expect(metrics.homeWidth).toBeLessThanOrEqual(Math.min(metrics.viewport, 1440) + 2)
}

test.describe('WEB desktop / responsive layout', () => {
  for (const width of WIDTHS) {
    test(`home @ ${width}px has no horizontal overflow`, async ({ page }) => {
      await page.setViewportSize({ width, height: width >= 1024 ? 900 : 844 })
      await page.goto('/')
      await waitForHomeReady(page)
      await assertNoHorizontalOverflow(page)
      await assertWideDesktopShell(page, width)
      await page.screenshot({
        path: path.join('test-results', `web-home-${width}.png`),
        fullPage: true,
      })
    })
  }

  test('catalog / profile use wide desktop shell', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    await page.goto('/games')
    await expect(page.getByText(/что запускаем сегодня/i).first()).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.games-page')).toBeVisible()
    const catalogW = await page.evaluate(
      () => (document.querySelector('.games-page') as HTMLElement | null)?.getBoundingClientRect().width ?? 0,
    )
    expect(catalogW).toBeGreaterThan(700)
    expect(catalogW).toBeLessThanOrEqual(1442)
    await assertNoHorizontalOverflow(page)

    await page.goto('/profile')
    await expect(page.locator('.profile-page')).toBeVisible({ timeout: 30_000 })
    const profileW = await page.evaluate(
      () => (document.querySelector('.profile-page') as HTMLElement | null)?.getBoundingClientRect().width ?? 0,
    )
    expect(profileW).toBeGreaterThan(700)
    expect(profileW).toBeLessThanOrEqual(1442)
    await assertNoHorizontalOverflow(page)
  })

  test('desktop home shows WEB nav and wide composition', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await waitForHomeReady(page)
    await expect(page.getByRole('navigation', { name: /Главная навигация|Основная навигация/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Попробуйте сегодня|Популярные/i })).toBeVisible()
    const homeW = await page.evaluate(() => {
      const home =
        (document.querySelector('.gnh-home-ref .wrap') as HTMLElement | null) ||
        (document.querySelector('.gnh-home-ref') as HTMLElement | null) ||
        (document.querySelector('.home-page') as HTMLElement | null)
      return home?.getBoundingClientRect().width ?? 0
    })
    expect(homeW).toBeGreaterThan(900)
  })
})
