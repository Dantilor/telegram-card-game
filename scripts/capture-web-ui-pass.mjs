/**
 * Acceptance screenshots for WEB UI pass (built preview or Vite).
 * Usage: node scripts/capture-web-ui-pass.mjs [baseUrl]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const baseURL = process.argv[2] || process.env.GNH_E2E_BASE_URL || 'http://127.0.0.1:5173'
const outDir = path.join(process.cwd(), 'artifacts', 'web-ui-pass')
fs.mkdirSync(outDir, { recursive: true })

const themes = [
  { name: 'neon', label: 'Neon' },
  { name: 'light', label: 'Light' },
  { name: 'sunset', label: 'Sunset' },
  { name: 'calm', label: 'Calm' },
]

async function dismissLegal(page) {
  const later = page.getByRole('button', { name: /Позже/i })
  if (await later.isVisible().catch(() => false)) await later.click()
}

async function waitHome(page) {
  await page.locator('.home-page').waitFor({ timeout: 30_000 })
  await page.getByRole('link', { name: /Начать игру/i }).first().waitFor({ timeout: 30_000 })
  await dismissLegal(page)
}

const browser = await chromium.launch({
  channel: process.env.GNH_E2E_CHANNEL || 'msedge',
  headless: true,
})
const page = await browser.newPage()

// Loader (cold navigation)
await page.setViewportSize({ width: 390, height: 844 })
await page.goto(baseURL + '/', { waitUntil: 'domcontentloaded' })
await page.screenshot({ path: path.join(outDir, 'built-loader-390.png') })
await waitHome(page)

for (const theme of themes) {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(baseURL + '/')
  await waitHome(page)
  await page.getByRole('button', { name: theme.label, exact: true }).click()
  await page.waitForTimeout(250)
  await page.screenshot({
    path: path.join(outDir, `built-home-${theme.name}-1440.png`),
    fullPage: true,
  })
}

await page.setViewportSize({ width: 390, height: 844 })
await page.goto(baseURL + '/')
await waitHome(page)
await page.getByRole('button', { name: 'Neon', exact: true }).click()
await page.locator('.home-web-picks--popular').scrollIntoViewIfNeeded()
await page.screenshot({ path: path.join(outDir, 'built-home-mobile-picks-390.png'), fullPage: true })

await page.setViewportSize({ width: 1366, height: 768 })
await page.goto(baseURL + '/play/aboutUs')
await page.locator('.play-card__text').waitFor({ timeout: 30_000 })
await page.screenshot({ path: path.join(outDir, 'built-play-aboutUs-1366x768.png') })

await page.setViewportSize({ width: 375, height: 812 })
await page.goto(baseURL + '/')
await waitHome(page)
await page.screenshot({ path: path.join(outDir, 'built-home-375.png'), fullPage: true })

await page.setViewportSize({ width: 1024, height: 768 })
await page.goto(baseURL + '/')
await waitHome(page)
await page.screenshot({ path: path.join(outDir, 'built-home-1024.png'), fullPage: true })

const metrics = await page.evaluate(() => {
  const thumbs = [...document.querySelectorAll('.home-picks__thumb-wrap')].slice(0, 3).map((el) => {
    const r = el.getBoundingClientRect()
    return { w: Math.round(r.width), h: Math.round(r.height) }
  })
  const quick = [...document.querySelectorAll('[class*="-quick__card"]')].map((el) =>
    Math.round(el.getBoundingClientRect().height),
  )
  return { thumbs, quick, overflowX: document.documentElement.scrollWidth > window.innerWidth + 1 }
})
fs.writeFileSync(path.join(outDir, 'metrics-1024.json'), JSON.stringify(metrics, null, 2))

await browser.close()
console.log('SHOTS_OK', outDir)
console.log(metrics)
