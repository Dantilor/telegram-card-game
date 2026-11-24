import { expect, test, type Page } from '@playwright/test'

const BASE = process.env.GNH_E2E_BASE_URL || 'http://127.0.0.1:3011'

async function quietLegal(page: Page) {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem('gnh_legal_sheet_closed', '1')
      localStorage.setItem('gnh_web_welcome_v1', '1')
    } catch {
      /* ignore */
    }
  })
}

/** Seed consent once — never overwrite a later revoke on reload. */
async function seedConsentOnce(page: Page, value: 'granted' | 'denied') {
  await page.addInitScript((consent) => {
    try {
      if (localStorage.getItem('gnh_metrika_consent_v1') == null) {
        localStorage.setItem('gnh_metrika_consent_v1', consent)
      }
    } catch {
      /* ignore */
    }
  }, value)
}

async function stubTagJs(page: Page) {
  await page.route('**/metrika/tag.js**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `
        window.__ymCalls = window.__ymCalls || [];
        window.ym = function(){ window.__ymCalls.push([].slice.call(arguments)); };
        window.ym.l = +new Date;
      `,
    })
  })
}

test.describe('WEB Yandex Metrika', () => {
  test('refusal keeps tag.js and mc.yandex.ru offline', async ({ page }) => {
    await quietLegal(page)
    await seedConsentOnce(page, 'denied')
    const blocked: string[] = []
    page.on('request', (req) => {
      if (/mc\.yandex\.(ru|com)|metrika\/tag\.js/.test(req.url())) blocked.push(req.url())
    })
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1200)
    await page.goto(`${BASE}/games`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(800)
    expect(blocked).toEqual([])
    expect(await page.locator('script[data-gnh-metrika="1"]').count()).toBe(0)
  })

  test('grant loads tag.js once and SPA hit does not duplicate first view', async ({ page }) => {
    await quietLegal(page)
    await seedConsentOnce(page, 'granted')
    await stubTagJs(page)

    const tagRequests: string[] = []
    page.on('request', (req) => {
      if (/metrika\/tag\.js/.test(req.url())) tagRequests.push(req.url())
    })

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
    await expect.poll(async () => page.locator('script[data-gnh-metrika="1"]').count()).toBe(1)
    const firstBatch = tagRequests.length
    expect(firstBatch).toBeGreaterThanOrEqual(1)

    const gamesLink = page.locator('a[href="/games"]').first()
    await expect(gamesLink).toBeVisible({ timeout: 10_000 })
    await gamesLink.click()
    await expect(page).toHaveURL(/\/games/)
    await page.waitForTimeout(800)
    expect(tagRequests.length).toBe(firstBatch)
  })

  test('banner appears without consent and accept enables counter', async ({ page }) => {
    await quietLegal(page)
    await page.addInitScript(() => {
      try {
        localStorage.removeItem('gnh_metrika_consent_v1')
      } catch {
        /* ignore */
      }
    })
    await stubTagJs(page)
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    const banner = page.getByRole('dialog', { name: 'Согласие на аналитику' })
    await expect(banner).toBeVisible({ timeout: 10_000 })
    await banner.getByRole('button', { name: 'Разрешить Метрику' }).click()
    await expect(banner).toBeHidden()
    await expect.poll(async () => page.locator('script[data-gnh-metrika="1"]').count()).toBe(1)
  })

  test('revoke after grant stops further Metrika requests and does not reload the tag', async ({ page }) => {
    await quietLegal(page)
    await seedConsentOnce(page, 'granted')
    await stubTagJs(page)

    const metrikaUrls: string[] = []
    page.on('request', (req) => {
      if (/mc\.yandex\.(ru|com)|metrika\/tag\.js/.test(req.url())) metrikaUrls.push(req.url())
    })

    await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' })
    await expect.poll(async () => page.locator('script[data-gnh-metrika="1"]').count()).toBe(1)
    expect(metrikaUrls.length).toBeGreaterThanOrEqual(1)

    await expect(page.getByRole('heading', { name: 'Яндекс Метрика' })).toBeVisible({ timeout: 15_000 })
    const stop = page.getByRole('button', { name: 'Отключить Метрику' })
    await expect(stop).toBeVisible({ timeout: 10_000 })

    await Promise.all([
      page.waitForURL(/\/profile\/?$/, { waitUntil: 'domcontentloaded' }),
      stop.click(),
    ])
    await expect.poll(async () => page.evaluate(() => localStorage.getItem('gnh_metrika_consent_v1'))).toBe(
      'denied'
    )
    await page.waitForLoadState('networkidle')
    expect(await page.locator('script[data-gnh-metrika="1"]').count()).toBe(0)
    expect(
      await page.evaluate(
        () => (window as unknown as Record<string, unknown>)['disableYaCounter114652319'] === true
      )
    ).toBe(true)

    const beforeNav = metrikaUrls.length
    await page.goto(`${BASE}/games`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(800)
    await page.goto(`${BASE}/quiz`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(800)

    const newLoads = metrikaUrls.slice(beforeNav).filter((u) => /metrika\/tag\.js/.test(u))
    expect(newLoads).toEqual([])
    expect(await page.locator('script[data-gnh-metrika="1"]').count()).toBe(0)
  })

  test('mobile layout keeps games usable after declining analytics', async ({ page }) => {
    await quietLegal(page)
    await page.addInitScript(() => {
      try {
        localStorage.removeItem('gnh_metrika_consent_v1')
      } catch {
        /* ignore */
      }
    })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${BASE}/games`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(800)
    const overflow = await page.evaluate(() => {
      const root = document.documentElement
      return root.scrollWidth - root.clientWidth
    })
    expect(overflow).toBeLessThanOrEqual(2)

    const decline = page.getByRole('button', { name: 'Отказаться' })
    await expect(decline).toBeVisible({ timeout: 10_000 })
    await Promise.all([
      page.waitForURL(/\/games\/?$/, { waitUntil: 'domcontentloaded' }),
      decline.click(),
    ])
    await page.waitForLoadState('networkidle')
    expect(await page.evaluate(() => localStorage.getItem('gnh_metrika_consent_v1'))).toBe('denied')

    await page.goto(`${BASE}/quiz`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByText(/Ставка сделана|Квиз|вопрос/i).first()).toBeVisible({ timeout: 15_000 })
  })
})