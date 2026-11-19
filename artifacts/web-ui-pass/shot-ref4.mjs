import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' })
await page.locator('.mood', { hasText: 'Компания' }).click()
await page.waitForURL('**/mode/**', { timeout: 8000 })
console.log('mode', page.url())
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' })
await page.locator('.mood', { hasText: '18+' }).click()
await page.waitForTimeout(400)
console.log('adult-or-premium', await page.locator('.premium-overlay').count(), await page.locator('.adult-confirm-modal').count(), page.url())
await page.keyboard.press('Escape')
await page.locator('.desktop-nav button.nav-link', { hasText: 'Избранное' }).click()
await page.waitForTimeout(400)
console.log('fav', await page.locator('.premium-overlay').count(), page.url())
await page.goto('http://127.0.0.1:4173/games', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(300)
console.log('games', JSON.stringify(await page.evaluate(() => ({
  home: !!document.querySelector('.gnh-home-ref'),
  theme: document.querySelector('.gnh-theme-background') ? getComputedStyle(document.querySelector('.gnh-theme-background')).visibility : 'none',
  page: !!document.querySelector('.games-page'),
}))))
const phone = await browser.newPage({ viewport: { width: 390, height: 844 } })
await phone.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' })
await phone.locator('.menu-button').click()
console.log('menu', await phone.locator('.gnh-menu.is-open').count())
await phone.screenshot({ path: 'artifacts/web-ui-pass/ref-phone-menu.png' })
await browser.close()
