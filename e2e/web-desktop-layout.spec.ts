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
  await expect(page.locator('.home-page')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('link', { name: /Начать игру/i }).first()).toBeVisible({ timeout: 30_000 })
}

/** WEB must stay a phone-column shell (Mini App look), not a wide desktop layout. */
async function assertPhoneColumnOnWideViewport(page: Page, width: number) {
  if (width < 1024) return
  const metrics = await page.evaluate(() => {
    const app = document.querySelector('.app.app--web') as HTMLElement | null
    const home = document.querySelector('.home-page') as HTMLElement | null
    return {
      appWidth: app?.getBoundingClientRect().width ?? 0,
      homeWidth: home?.getBoundingClientRect().width ?? 0,
      viewport: window.innerWidth,
    }
  })
  expect(metrics.appWidth).toBeLessThanOrEqual(480)
  expect(metrics.homeWidth).toBeLessThanOrEqual(480)
  // Phone column (~470px) must stay clearly narrower than desktop viewports.
  expect(metrics.appWidth).toBeLessThan(metrics.viewport * 0.5)
}

test.describe('WEB phone-column layout (Mini App look)', () => {
  for (const width of WIDTHS) {
    test(`home @ ${width}px has no horizontal overflow`, async ({ page }) => {
      await page.setViewportSize({ width, height: width >= 1024 ? 900 : 844 })
      await page.goto('/')
      await waitForHomeReady(page)
      await assertNoHorizontalOverflow(page)
      await assertPhoneColumnOnWideViewport(page, width)
      await page.screenshot({
        path: path.join('test-results', `web-home-${width}.png`),
        fullPage: true,
      })
    })
  }

  test('catalog / game / profile stay phone-width on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    await page.goto('/games')
    await expect(page.getByText(/что запускаем сегодня/i).first()).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.games-page')).toBeVisible()
    const catalogW = await page.evaluate(
      () => (document.querySelector('.games-page') as HTMLElement | null)?.getBoundingClientRect().width ?? 0,
    )
    expect(catalogW).toBeLessThanOrEqual(480)
    await assertNoHorizontalOverflow(page)

    await page.goto('/profile')
    await expect(page.locator('.profile-page')).toBeVisible({ timeout: 30_000 })
    const profileW = await page.evaluate(
      () => (document.querySelector('.profile-page') as HTMLElement | null)?.getBoundingClientRect().width ?? 0,
    )
    expect(profileW).toBeLessThanOrEqual(480)
    await assertNoHorizontalOverflow(page)
  })

  test('desktop home hides WEB nav and keeps Mini App column', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await waitForHomeReady(page)
    await expect(page.getByRole('navigation', { name: /Основная навигация/i })).toBeHidden()
    await expect(page.getByRole('heading', { name: /Попробуйте сегодня|Популярные/i })).toBeVisible()
    const appW = await page.evaluate(
      () => (document.querySelector('.app.app--web') as HTMLElement | null)?.getBoundingClientRect().width ?? 0,
    )
    expect(appW).toBeLessThanOrEqual(480)
  })
})
