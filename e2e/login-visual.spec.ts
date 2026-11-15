import { expect, test } from '@playwright/test'
import path from 'node:path'

/**
 * Visual smoke for Premium login gate (anonymous).
 * Does not complete OIDC — only layout/contrast surface.
 */
test.describe('WEB login visual', () => {
  test('desktop shows aurora login with high-contrast title and CTA', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'GameNight Host' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Твой вечер. Твои правила. Твоя игра.')).toBeVisible()
    const cta = page.getByRole('button', { name: /Войти через Telegram/i })
    await expect(cta).toBeVisible()

    const titleColor = await page.locator('.web-auth-gate__title').evaluate((el) => getComputedStyle(el).color)
    // Expect near-white title on dark canvas (rgb high channels).
    const m = titleColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    expect(m).toBeTruthy()
    const [, r, g, b] = m!.map(Number)
    expect(r).toBeGreaterThan(200)
    expect(g).toBeGreaterThan(200)
    expect(b).toBeGreaterThan(200)

    const gateBg = await page.locator('.web-auth-gate').evaluate((el) => getComputedStyle(el).backgroundImage)
    expect(gateBg.toLowerCase()).toContain('gradient')

    await page.screenshot({
      path: path.join('test-results', 'login-desktop.png'),
      fullPage: true,
    })
  })

  test('iphone viewport keeps CTA and title without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'GameNight Host' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('button', { name: /Войти через Telegram/i })).toBeVisible()

    const overflowX = await page.evaluate(() => {
      const doc = document.documentElement
      return doc.scrollWidth > doc.clientWidth + 1
    })
    expect(overflowX).toBe(false)

    await page.screenshot({
      path: path.join('test-results', 'login-iphone.png'),
      fullPage: true,
    })
  })
})
