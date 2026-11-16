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

async function assertAppIsWideOnDesktop(page: Page, width: number) {
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
  expect(metrics.appWidth).toBeGreaterThan(metrics.viewport * 0.9)
  expect(metrics.homeWidth).toBeGreaterThan(560)
}

test.describe('WEB desktop layout', () => {
  for (const width of WIDTHS) {
    test(`home @ ${width}px has no horizontal overflow`, async ({ page }) => {
      await page.setViewportSize({ width, height: width >= 1024 ? 900 : 844 })
      await page.goto('/')
      await waitForHomeReady(page)
      await assertNoHorizontalOverflow(page)
      await assertAppIsWideOnDesktop(page, width)
      await page.screenshot({
        path: path.join('test-results', `web-home-${width}.png`),
        fullPage: true,
      })
    })
  }

  test('catalog / game / profile / premium screenshots @ desktop and mobile', async ({ page }) => {
    for (const width of [390, 1440] as const) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })

      await page.goto('/games')
      await expect(page.getByText(/что запускаем сегодня/i).first()).toBeVisible({ timeout: 30_000 })
      await expect(page.locator('.games-page')).toBeVisible()
      if (width >= 1440) {
        const catalog = await page.evaluate(() => {
          const gp = document.querySelector('.games-page') as HTMLElement | null
          const grid = document.querySelector('.games-grid') as HTMLElement | null
          return {
            width: gp?.getBoundingClientRect().width ?? 0,
            cols: grid
              ? getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length
              : 0,
          }
        })
        expect(catalog.width).toBeGreaterThan(900)
        expect(catalog.cols).toBeGreaterThanOrEqual(3)
      }
      await assertNoHorizontalOverflow(page)
      await page.screenshot({
        path: path.join('test-results', `web-games-${width}.png`),
        fullPage: true,
      })

      await page.goto('/mafia')
      await expect(page.locator('.app')).toBeVisible({ timeout: 30_000 })
      await assertNoHorizontalOverflow(page)
      await page.screenshot({
        path: path.join('test-results', `web-game-${width}.png`),
        fullPage: true,
      })

      await page.goto('/profile')
      await expect(page.locator('.profile-page')).toBeVisible({ timeout: 30_000 })
      await assertNoHorizontalOverflow(page)
      await page.screenshot({
        path: path.join('test-results', `web-profile-${width}.png`),
        fullPage: true,
      })

      await page.goto('/premium')
      await expect(page.locator('.premium-overlay__card, .premium-page').first()).toBeVisible({
        timeout: 30_000,
      })
      await assertNoHorizontalOverflow(page)
      await page.screenshot({
        path: path.join('test-results', `web-premium-${width}.png`),
        fullPage: true,
      })
    }
  })

  test('desktop home shows nav and popular/new sections', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await waitForHomeReady(page)
    await expect(page.getByRole('navigation', { name: /Основная навигация/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Популярные' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Новые игры' })).toBeVisible()
    const cols = await page.evaluate(() => {
      const list = document.querySelector('.home-web-picks--popular .home-web-picks__list')
      if (!list) return 0
      return getComputedStyle(list).gridTemplateColumns.split(' ').filter(Boolean).length
    })
    expect(cols).toBeGreaterThanOrEqual(3)
  })
})
