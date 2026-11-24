import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { BASE_URL } from './helpers'

/**
 * SEO crawlability against the production-like Express static server (built dist-web + manifest).
 * Run with GNH_E2E_BASE_URL pointing at an Express instance with GNH_SERVE_WEB_STATIC=1.
 */
const ORIGIN = 'https://play.gamenighthost.ru'
const LANDINGS = [
  '/discover/igry-dlya-kompanii',
  '/discover/mafiya-onlajn',
  '/discover/igry-dlya-dvoih',
  '/discover/igry-dlya-vecherinki',
  '/discover/associacii-alias',
]
const PUBLIC_PAGES = ['/', '/games', ...LANDINGS]
const PRIVATE_PAGES = ['/profile', '/recover', '/login', '/premium?payment=return', '/mafia-shadows?room=123456']

const local = (url: string) => url.replace(ORIGIN, BASE_URL)

async function headOf(request: APIRequestContext, path: string) {
  const res = await request.get(`${BASE_URL}${path}`, { maxRedirects: 0 })
  const html = await res.text()
  const pick = (re: RegExp) => html.match(re)?.[1] ?? null
  return {
    res,
    html,
    title: pick(/<title>([^<]*)<\/title>/),
    description: pick(/<meta name="description" content="([^"]*)"/),
    canonical: pick(/<link rel="canonical" href="([^"]*)"/),
    robots: pick(/<meta name="robots" content="([^"]*)"/),
    ogImage: pick(/<meta property="og:image" content="([^"]*)"/),
    ogTitle: pick(/<meta property="og:title" content="([^"]*)"/),
    twitterCard: pick(/<meta name="twitter:card" content="([^"]*)"/),
    h1: pick(/<h1>([^<]*)<\/h1>/),
  }
}

async function quietOverlays(page: Page) {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem('gnh_legal_sheet_closed', '1')
      localStorage.setItem('gnh_web_welcome_v1', '1')
      localStorage.setItem('gnh_metrika_consent_v1', 'denied')
    } catch {
      /* storage unavailable */
    }
  })
}

test.describe('SEO: robots and sitemap', () => {
  test('robots.txt is plain text, references the sitemap and never blocks the site', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/robots.txt`)
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('text/plain')
    const body = await res.text()
    expect(body).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`)
    expect(body).not.toMatch(/^Disallow:\s*\/\s*$/m)
    expect(body).toMatch(/^Disallow: \/api\/$/m)
  })

  test('sitemap.xml lists only live canonical URLs', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/sitemap.xml`)
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toMatch(/xml/)
    const xml = await res.text()
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
    expect(locs.sort()).toEqual(PUBLIC_PAGES.map((p) => `${ORIGIN}${p}`).sort())
    for (const loc of locs) {
      const page = await headOf(request, new URL(loc).pathname)
      expect(page.res.status(), loc).toBe(200)
      expect(page.canonical, loc).toBe(loc)
      expect(page.robots, loc).toContain('index, follow')
    }
  })
})

test.describe('SEO: metadata and social previews', () => {
  test('home has the agreed title, description, canonical and OG image', async ({ request }) => {
    const home = await headOf(request, '/')
    expect(home.title).toBe('GameNight Host — онлайн-игры для компании и друзей')
    expect(home.description?.length ?? 0).toBeGreaterThan(80)
    expect(home.canonical).toBe(`${ORIGIN}/`)
    expect(home.h1).toBe('Игры для компании, друзей и незабываемых вечеров')
    expect(home.twitterCard).toBe('summary_large_image')
    expect(home.html).toContain('"@type":"WebSite"')
    expect(home.html).not.toMatch(/aggregateRating|FAQPage/)
  })

  test('every public page has unique metadata and a public 1200x630 OG image', async ({ request }) => {
    const titles = new Set<string>()
    for (const path of PUBLIC_PAGES) {
      const page = await headOf(request, path)
      expect(page.title, path).toBeTruthy()
      expect(page.description, path).toBeTruthy()
      titles.add(page.title!)
      expect(page.ogImage, path).toMatch(new RegExp(`^${ORIGIN}/og/[a-z-]+\\.jpg$`))
      const image = await request.get(local(page.ogImage!))
      expect(image.status(), page.ogImage!).toBe(200)
      expect(image.headers()['content-type']).toBe('image/jpeg')
      expect((await image.body()).length).toBeGreaterThan(20_000)
    }
    expect(titles.size).toBe(PUBLIC_PAGES.length)
  })
})

test.describe('SEO: crawlable HTML without JavaScript', () => {
  test('public pages render real content with JS disabled', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()
    for (const path of PUBLIC_PAGES) {
      await page.goto(`${BASE_URL}${path}`)
      await expect(page.locator('h1'), path).toHaveCount(1)
      await expect(page.locator('h1'), path).toBeVisible()
      const text = await page.locator('#root').innerText()
      expect(text.length, path).toBeGreaterThan(600)
      expect(await page.locator('#root a[href^="/"]').count(), path).toBeGreaterThan(5)
    }
    await page.goto(`${BASE_URL}/discover/mafiya-onlajn`)
    await expect(page.getByRole('heading', { name: 'Мафия Lite: как играть' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '«Мафия: Тени города»: как играть' })).toBeVisible()
    await page.screenshot({ path: 'test-results/seo/landing-no-js.png', fullPage: false })
    await context.close()
  })

  test('private pages are noindex (header and meta)', async ({ request }) => {
    for (const path of PRIVATE_PAGES) {
      const page = await headOf(request, path)
      expect(page.res.status(), path).toBe(200)
      expect(page.res.headers()['x-robots-tag'], path).toBe('noindex')
      expect(page.robots, path).toContain('noindex')
      expect(page.canonical, path).toBeNull()
    }
  })

  test('unknown URLs return 404 noindex instead of an indexable home page', async ({ request }) => {
    for (const path of ['/discover/neizvestnaya-stranica', '/no-such-page', '/games/extra']) {
      const page = await headOf(request, path)
      expect(page.res.status(), path).toBe(404)
      expect(page.res.headers()['x-robots-tag'], path).toBe('noindex')
      expect(page.robots, path).toContain('noindex')
      expect(page.canonical, path).toBeNull()
      expect(page.title, path).not.toBe('GameNight Host — онлайн-игры для компании и друзей')
    }
    const slash = await request.get(`${BASE_URL}/games/`, { maxRedirects: 0 })
    expect(slash.status()).toBe(301)
    expect(slash.headers().location).toBe('/games')
  })
})

test.describe('SEO: pages in the browser', () => {
  test.beforeEach(async ({ page }) => {
    await quietOverlays(page)
  })

  test('direct landing URL hydrates into the SPA with the same content', async ({ page }) => {
    await page.goto(`${BASE_URL}/discover/igry-dlya-kompanii`)
    await expect(page.locator('.gnh-seo-host h1')).toHaveText('Игры для компании друзей')
    await expect(page).toHaveTitle('Игры для компании: мафия, детективы, Ассоциации | GameNight Host')
    await expect(page.locator('.gnh-seo-host img').first()).toBeVisible()
  })

  test('internal links navigate inside the SPA and update head tags', async ({ page }) => {
    await page.goto(`${BASE_URL}/discover/igry-dlya-kompanii`)
    await expect(page.locator('.gnh-seo-host h1')).toBeVisible()
    await page.evaluate(() => {
      ;(window as unknown as { __gnhNoReload?: number }).__gnhNoReload = 1
    })
    await page.locator('.gnh-seo__related a[href="/discover/igry-dlya-dvoih"]').click()
    await expect(page).toHaveURL(`${BASE_URL}/discover/igry-dlya-dvoih`)
    await expect(page.locator('.gnh-seo-host h1')).toHaveText('Игры для двоих')
    await expect(page).toHaveTitle(/Игры для двоих/)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${ORIGIN}/discover/igry-dlya-dvoih`)
    expect(await page.evaluate(() => (window as unknown as { __gnhNoReload?: number }).__gnhNoReload)).toBe(1)

    await page.locator('.gnh-seo__header a[href="/"]').click()
    await expect(page).toHaveURL(`${BASE_URL}/`)
    await expect(page.locator('.gnh-home-ref h1')).toHaveText('Игры для компании, друзей и незабываемых вечеров')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /index, follow/)
    await page.goto(`${BASE_URL}/profile`)
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  })

  test('games open from landing pages', async ({ page }) => {
    await page.goto(`${BASE_URL}/discover/igry-dlya-dvoih`)
    await page.locator('.gnh-seo-host h3 a[href="/quiz"]').click()
    await expect(page).toHaveURL(`${BASE_URL}/quiz`)
    await expect(page.getByText('Ставка сделана. Ответишь правильно?')).toBeVisible()

    await page.goto(`${BASE_URL}/discover/mafiya-onlajn`)
    await page.locator('.gnh-seo-host h3 a[href="/mafia-shadows"]').click()
    await expect(page).toHaveURL(`${BASE_URL}/mafia-shadows`)
    await expect(page.getByText(/Войти по коду/).first()).toBeVisible()
  })
})

test.describe('SEO: mobile layout', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 })

  test('landing and 404 fit the phone viewport', async ({ page }) => {
    await quietOverlays(page)
    for (const path of [...LANDINGS, '/no-such-page']) {
      await page.goto(`${BASE_URL}${path}`)
      const root = page.locator('.gnh-seo-host .gnh-seo')
      await expect(root).toBeVisible()
      const overflow = await root.evaluate((el) => el.scrollWidth - el.clientWidth)
      expect(overflow, path).toBeLessThanOrEqual(1)
      const cta = await page.locator('.gnh-seo__cta').boundingBox()
      expect(cta, path).not.toBeNull()
      expect(cta!.x).toBeGreaterThanOrEqual(0)
      expect(cta!.x + cta!.width).toBeLessThanOrEqual(390)
    }
    await page.goto(`${BASE_URL}/discover/mafiya-onlajn`)
    await page.screenshot({ path: 'test-results/seo/landing-mobile.png' })
    await page.goto(`${BASE_URL}/`)
    await expect(page.locator('.gnh-home-ref h1')).toBeVisible()
    await page.screenshot({ path: 'test-results/seo/home-mobile.png' })
  })
})