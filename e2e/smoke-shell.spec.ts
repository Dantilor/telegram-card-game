import { test, expect } from '@playwright/test'
import { BASE_URL, USERS, devLogin } from './helpers'

test.describe('WEB shell smoke', () => {
  test.beforeEach(async ({ page }) => {
    await devLogin(page, USERS.premium1m, 'Smoke Host')
  })

  test('home, catalog, profile, themes area visible', async ({ page }) => {
    await page.goto(`${BASE_URL}/`)
    await expect(page.getByText('GameNight Host').first()).toBeVisible()

    // Catalog / games navigation — labels may vary; hit common routes
    for (const path of ['/games', '/play', '/profile', '/premium']) {
      await page.goto(`${BASE_URL}${path}`)
      await expect(page.locator('body')).toBeVisible()
      // No full-page crash overlay
      await expect(page.getByText(/Something went wrong|Unhandled|Invariant/i)).toHaveCount(0)
    }
  })

  test('legal document route opens without crash', async ({ page }) => {
    await page.goto(`${BASE_URL}/legal/offer`)
    await expect(page.locator('body')).toBeVisible()
  })

  test('offline game route loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/games/truth-dare`)
    await expect(page.locator('body')).toBeVisible()
  })

  test('cold home under slow network still paints brand', async ({ page, context }) => {
    await context.route('**/*', async (route) => {
      await new Promise((r) => setTimeout(r, 50))
      await route.continue()
    })
    const started = Date.now()
    await page.goto(`${BASE_URL}/`)
    await expect(page.getByText('GameNight Host').first()).toBeVisible({ timeout: 20_000 })
    const elapsed = Date.now() - started
    test.info().annotations.push({ type: 'perf', description: `home_visible_ms=${elapsed}` })
  })
})
