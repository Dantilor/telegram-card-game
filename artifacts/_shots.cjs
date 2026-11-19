const { chromium } = require('@playwright/test')
const fs = require('fs')
const path = require('path')
const out = path.join('artifacts', 'release-screenshots')
fs.mkdirSync(out, { recursive: true })
const themes = [
  ['neon-light', 'home-light-1440.png'],
  ['neon-dark', 'home-neon-1440.png'],
  ['sunset', 'home-sunset-1440.png'],
  ['minimal-calm', 'home-calm-1440.png'],
]
;(async () => {
  let browser
  for (const channel of ['chrome', 'msedge', undefined]) {
    try {
      browser = await chromium.launch(channel ? { channel } : {})
      console.log('launched', channel || 'bundled')
      break
    } catch (e) {
      console.log('fail', channel, String(e.message).split('\n')[0])
    }
  }
  if (!browser) throw new Error('no browser')
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForSelector('.home-page', { timeout: 30000 })
  for (const [theme, file] of themes) {
    await page.evaluate((t) => {
      localStorage.setItem('tcg_theme', t)
      document.documentElement.dataset.theme = t
    }, theme)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.home-page', { timeout: 30000 })
    await page.waitForTimeout(700)
    await page.screenshot({ path: path.join(out, file), fullPage: true })
    console.log('saved', file)
  }
  await page.goto('http://127.0.0.1:4173/games', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(900)
  await page.screenshot({ path: path.join(out, 'catalog-light-1440.png'), fullPage: true })
  await page.goto('http://127.0.0.1:4173/profile', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(900)
  await page.screenshot({ path: path.join(out, 'profile-light-1440.png'), fullPage: true })
  await browser.close()
  console.log('done')
})().catch((e) => { console.error(e); process.exit(1) })
