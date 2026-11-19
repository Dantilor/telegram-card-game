import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'msedge', headless: true })

async function shoot(width, height, name, mock) {
  const page = await browser.newPage({ viewport: { width, height } })
  if (mock) {
    await page.route('**/api/public-stats', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ usersCount: 12840 }),
    }))
  }
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(500)
  const info = await page.evaluate(() => {
    const art = document.querySelector('.hero-art')
    const cs = art ? getComputedStyle(art) : null
    const nodes = [...document.querySelectorAll('h1, .hero-subtitle, .hero-play, .mood, .gnh-player-count, .site-header, .mobile-nav, .section-heading')]
    const boxes = nodes.map((n) => {
      const r = n.getBoundingClientRect()
      return { t: n.className.toString().slice(0, 40), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
    })
    return {
      eyebrow: !!document.querySelector('.eyebrow'),
      welcome: !!document.querySelector('.home-welcome-top'),
      theme: !!document.querySelector('.gnh-theme-menu'),
      count: document.querySelector('.gnh-player-count')?.textContent?.trim() || null,
      artSize: cs ? cs.backgroundSize : null,
      artPos: cs ? cs.backgroundPosition : null,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      boxes,
    }
  })
  await page.screenshot({ path: `artifacts/web-ui-pass/${name}.png` })
  if (height > 800) {
    await page.locator('.gnh-home-scroll').evaluate((el) => { el.scrollTop = el.scrollHeight })
    await page.waitForTimeout(200)
    await page.screenshot({ path: `artifacts/web-ui-pass/${name}-bottom.png` })
  }
  await page.close()
  console.log(name, JSON.stringify(info))
}

await shoot(1440, 900, 'fit-desktop', true)
await shoot(390, 844, 'fit-phone', true)
await shoot(360, 780, 'fit-phone-narrow', true)
await browser.close()
