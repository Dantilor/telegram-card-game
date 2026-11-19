const { chromium } = require('@playwright/test')
const fs = require('fs')
const path = require('path')
const out = path.join('artifacts', 'release-screenshots', 'ref3')
fs.mkdirSync(out, { recursive: true })
;(async () => {
  const browser = await chromium.launch({ channel: 'msedge' })
  const desk = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await desk.addInitScript(() => {
    localStorage.setItem('tcg_theme', 'neon-dark')
    document.documentElement.dataset.theme = 'neon-dark'
  })
  await desk.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await desk.waitForSelector('.home-web-landing, .home-page', { timeout: 30000 })
  await desk.waitForTimeout(1200)
  await desk.screenshot({ path: path.join(out, 'home-desktop-1440.png'), fullPage: true })

  await desk.goto('http://127.0.0.1:4173/profile', { waitUntil: 'domcontentloaded' })
  await desk.waitForTimeout(1000)
  await desk.screenshot({ path: path.join(out, 'profile-desktop-1440.png'), fullPage: true })

  await desk.goto('http://127.0.0.1:4173/play/aboutUs', { waitUntil: 'domcontentloaded' })
  await desk.waitForTimeout(1500)
  await desk.screenshot({ path: path.join(out, 'play-desktop-1440.png'), fullPage: true })

  const mob = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await mob.addInitScript(() => {
    localStorage.setItem('tcg_theme', 'neon-dark')
    document.documentElement.dataset.theme = 'neon-dark'
  })
  await mob.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' })
  await mob.waitForSelector('.home-web-landing, .home-page', { timeout: 30000 })
  await mob.waitForTimeout(1000)
  await mob.screenshot({ path: path.join(out, 'home-mobile-390.png'), fullPage: true })
  await mob.goto('http://127.0.0.1:4173/profile', { waitUntil: 'domcontentloaded' })
  await mob.waitForTimeout(900)
  await mob.screenshot({ path: path.join(out, 'profile-mobile-390.png'), fullPage: true })
  await mob.goto('http://127.0.0.1:4173/play/aboutUs', { waitUntil: 'domcontentloaded' })
  await mob.waitForTimeout(1200)
  await mob.screenshot({ path: path.join(out, 'play-mobile-390.png'), fullPage: true })

  await browser.close()
  console.log('shots', fs.readdirSync(out).join(', '))
})().catch((e) => { console.error(e); process.exit(1) })
