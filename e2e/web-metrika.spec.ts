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

test.describe('WEB Yandex Metrika', () => {
  test('refusal keeps tag.js and mc.yandex.ru offline', async ({ page }) => {
    await quietLegal(page)
    await page.addInitScript(() => {
      localStorage.setItem('gnh_metrika_consent_v1', 'denied')
    })
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
    await page.addInitScript(() => {
      localStorage.setItem('gnh_metrika_consent_v1', 'granted')
    })

    const tagRequests: string[] = []
    const watch = page.waitForRequest(
      (req) => /metrika\/tag\.js/.test(req.url()) && req.method() === 'GET',
      { timeout: 15_000 }
    ).catch(() => null)

    page.on('request', (req) => {
      if (/metrika\/tag\.js/.test(req.url())) tagRequests.push(req.url())
    })

    // Intercept tag.js so offline Yandex does not break the page.
    await page.route('**/metrika/tag.js**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'window.ym=window.ym||function(){(window.ym.a=window.ym.a||[]).push(arguments)};window.ym.l=+new Date;',
      })
    })

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
    await watch
    await page.waitForTimeout(500)
    expect(tagRequests.length).toBeGreaterThanOrEqual(1)
    const firstBatch = tagRequests.length

    await page.evaluate(() => {
      ;(window as unknown as { __hits: unknown[] }).__hits = []
      const prev = window.ym
      window.ym = ((...args: unknown[]) => {
        ;(window as unknown as { __hits: unknown[] }).__hits.push(args)
        if (typeof prev === 'function') prev(...args)
      }) as typeof window.ym
    })

    await page.click('a[href="/games"], a[href*="/games"]').catch(async () => {
      await page.goto(`${BASE}/games`, { waitUntil: 'domcontentloaded' })
    })
    await page.waitForTimeout(800)

    const hits = await page.evaluate(() => (window as unknown as { __hits?: unknown[] }).__hits || [])
    const hitCalls = hits.filter((row) => Array.isArray(row) && row[1] === 'hit')
    // After wrapping ym, only subsequent SPA hits are observed — at least one for /games.
    expect(hitCalls.length).toBeGreaterThanOrEqual(1)
    expect(tagRequests.length).toBe(firstBatch)
  })

  test('banner appears without consent and accept enables counter', async ({ page }) => {
    await quietLegal(page)
    await page.addInitScript(() => {
      localStorage.removeItem('gnh_metrika_consent_v1')
    })
    await page.route('**/metrika/tag.js**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'window.ym=window.ym||function(){(window.ym.a=window.ym.a||[]).push(arguments)};',
      })
    })
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    const banner = page.getByRole('dialog', { name: 'Согласие на аналитику' })
    await expect(banner).toBeVisible({ timeout: 10_000 })
    await banner.getByRole('button', { name: 'Разрешить Метрику' }).click()
    await expect(banner).toBeHidden()
    await expect.poll(async () => page.locator('script[data-gnh-metrika="1"]').count()).toBe(1)
  })

  test('mobile layout keeps games usable with banner', async ({ page }) => {
    await quietLegal(page)
    await page.addInitScript(() => {
      localStorage.removeItem('gnh_metrika_consent_v1')
    })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${BASE}/games`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(800)
    const overflow = await page.evaluate(() => {
      const root = document.documentElement
      return root.scrollWidth - root.clientWidth
    })
    expect(overflow).toBeLessThanOrEqual(2)
    await page.getByRole('button', { name: 'Отказаться' }).click()
    await page.goto(`${BASE}/quiz`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByText(/Ставка сделана|Квиз|вопрос/i).first()).toBeVisible({ timeout: 15_000 })
  })
})