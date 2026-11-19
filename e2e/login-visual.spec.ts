import { expect, test } from '@playwright/test'
import path from 'node:path'

/**
 * Visual smoke for anonymous WEB Home (no mandatory login gate).
 */
test.describe('WEB home visual (anonymous)', () => {
  test('desktop Home shows brand without Telegram login gate', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    await expect(page.getByText('GameNight Host').first()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('button', { name: /Войти через Telegram/i })).toHaveCount(0)

    await page.screenshot({
      path: path.join('test-results', 'home-desktop.png'),
      fullPage: true,
    })
  })

  test('iphone viewport Home without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await expect(page.getByText('GameNight Host').first()).toBeVisible({ timeout: 30_000 })

    const overflowX = await page.evaluate(() => {
      const doc = document.documentElement
      return doc.scrollWidth > doc.clientWidth + 1
    })
    expect(overflowX).toBe(false)

    await page.screenshot({
      path: path.join('test-results', 'home-iphone.png'),
      fullPage: true,
    })
  })
})
