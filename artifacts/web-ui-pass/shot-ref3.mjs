import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const notes = []
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
await page.locator('.mood', { hasText: 'Компания' }).click()
await page.waitForTimeout(500)
notes.push('mode ' + page.url())
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' })
await page.locator('.mood', { hasText: '18+' }).click()
await page.waitForTimeout(300)
notes.push('adult ' + await page.locator('.adult-confirm-modal').count() + ' url ' + page.url())
await page.locator('.adult-confirm__btn--secondary').click()
notes.push('adult closed ' + await page.locator('.adult-confirm-modal').count())
await page.locator('.desktop-nav button.nav-link', { hasText: 'Избранное' }).click()
await page.waitForTimeout(300)
notes.push('fav ' + await page.locator('.premium-overlay').count() + ' url ' + page.url())
await page.goto('http://127.0.0.1:4173/games', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(400)
notes.push('games ' + JSON.stringify(await page.evaluate(() => ({
  home: !!document.querySelector('.gnh-home-ref'),
  theme: getComputedStyle(document.querySelector('.gnh-theme-background')).visibility,
  page: !!document.querySelector('.games-page'),
}))))
const phone = await browser.newPage({ viewport: { width: 390, height: 844 } })
await phone.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
await phone.locator('.menu-button').click()
notes.push('menu ' + await phone.locator('.gnh-menu.is-open').count())
await phone.screenshot({ path: 'artifacts/web-ui-pass/ref-phone-top.png' })
await browser.close()
console.log(notes.join('\n'))
