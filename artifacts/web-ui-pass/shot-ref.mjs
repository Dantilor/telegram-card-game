import { chromium } from 'playwright'

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const notes = []
page.on('pageerror', (err) => notes.push('pageerror ' + err.message))
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(600)
notes.push('url ' + page.url())
notes.push('title ' + (await page.locator('h1').innerText().catch(() => 'none')))
const metrics = await page.evaluate(() => {
  const home = document.querySelector('.gnh-home-ref')
  const scroll = document.querySelector('.gnh-home-scroll')
  const app = document.querySelector('.app')
  const mood = document.querySelector('.mood')
  const card = document.querySelector('.game-card')
  const header = document.querySelector('.site-header')
  const hero = document.querySelector('.hero')
  const art = document.querySelector('.hero-art')
  const atmo = document.querySelector('.page-atmosphere')
  const titles = [...document.querySelectorAll('.game-title')].map((n) => n.textContent.trim())
  const modes = [...document.querySelectorAll('.mood span')].map((n) => n.textContent.trim())
  const cs = (el) => (el ? getComputedStyle(el) : null)
  const box = (el) => (el ? el.getBoundingClientRect() : null)
  return {
    home: !!home,
    scrollH: scroll ? scroll.scrollHeight : 0,
    scrollC: scroll ? scroll.clientHeight : 0,
    appOverflow: app ? getComputedStyle(app).overflowY : null,
    scrollOverflow: scroll ? getComputedStyle(scroll).overflowY : null,
    headerH: box(header)?.height,
    heroH: box(hero)?.height,
    moodH: box(mood)?.height,
    cardW: box(card)?.width,
    cardH: box(card)?.height,
    titles,
    modes,
    artBg: art ? cs(art).backgroundImage.slice(0, 80) : null,
    atmoBg: atmo ? cs(atmo).backgroundImage.slice(0, 120) : null,
    docW: document.documentElement.scrollWidth,
    winW: window.innerWidth,
    themeHidden: (() => {
      const t = document.querySelector('.gnh-theme-background')
      return t ? getComputedStyle(t).visibility : 'missing'
    })(),
    h1: document.querySelector('.hero h1')?.innerText,
    sub: document.querySelector('.hero-subtitle')?.textContent,
    cta: document.querySelector('.hero-play')?.textContent?.trim(),
  }
})
notes.push(JSON.stringify(metrics, null, 2))
await page.screenshot({ path: 'artifacts/web-ui-pass/ref-desktop-top.png' })
const scroll = page.locator('.gnh-home-scroll')
await scroll.evaluate((el) => { el.scrollTop = el.scrollHeight })
await page.waitForTimeout(250)
await page.screenshot({ path: 'artifacts/web-ui-pass/ref-desktop-bottom.png' })
await scroll.evaluate((el) => { el.scrollTop = 420 })
await page.waitForTimeout(200)
await page.screenshot({ path: 'artifacts/web-ui-pass/ref-desktop-mid.png' })

await page.locator('.game-open').first().click()
await page.waitForTimeout(500)
notes.push('after game ' + page.url())
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
await page.locator('.premium-banner .button, .premium-button').first().click()
await page.waitForTimeout(400)
const overlay = await page.locator('text=Premium').count()
notes.push('premium clicks overlay text count ' + overlay)
const overlayOpen = await page.evaluate(() => {
  const dialog = document.querySelector('[role="dialog"], .premium-overlay, .premium-modal')
  return dialog ? dialog.className : 'no-dialog'
})
notes.push('overlay ' + overlayOpen)
await page.keyboard.press('Escape')
await page.screenshot({ path: 'artifacts/web-ui-pass/ref-desktop-premium.png' })

const phone = await browser.newPage({ viewport: { width: 390, height: 844 } })
await phone.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
await phone.waitForTimeout(400)
const phoneMetrics = await phone.evaluate(() => {
  const nav = document.querySelector('.mobile-nav')
  const card = document.querySelector('.game-open')
  const mood = document.querySelector('.mood')
  const moods = document.querySelector('.moods')
  return {
    nav: nav ? getComputedStyle(nav).display : null,
    navBox: nav?.getBoundingClientRect(),
    cardH: card?.getBoundingClientRect().height,
    moodW: mood?.getBoundingClientRect().width,
    moodsW: moods?.clientWidth,
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    h1: document.querySelector('.hero h1')?.innerText,
  }
})
notes.push('phone ' + JSON.stringify(phoneMetrics))
await phone.screenshot({ path: 'artifacts/web-ui-pass/ref-phone-top.png' })
await phone.locator('.gnh-home-scroll').evaluate((el) => { el.scrollTop = el.scrollHeight })
await phone.waitForTimeout(200)
await phone.screenshot({ path: 'artifacts/web-ui-pass/ref-phone-bottom.png' })
await browser.close()
console.log(notes.join('\n'))
