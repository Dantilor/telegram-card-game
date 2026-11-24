import { expect, test } from '@playwright/test'

const BASE = process.env.GNH_E2E_BASE_URL || 'http://127.0.0.1:3011'
const METRIKA = /mc\.yandex\.(ru|com)|metrika\/tag\.js|yandex\.(ru|com)\/metrika|\/watch\/114652319/

test.describe('WEB has no Yandex Metrika', () => {
  test('no Metrika requests, script or cookies even with a legacy "granted" flag', async ({ page, context }) => {
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem('gnh_legal_sheet_closed', '1')
        localStorage.setItem('gnh_web_welcome_v1', '1')
        // Legacy value from the deferred integration must have no effect.
        localStorage.setItem('gnh_metrika_consent_v1', 'granted')
      } catch {
        /* ignore */
      }
    })

    const hits: string[] = []
    const errors: string[] = []
    page.on('request', (req) => {
      if (METRIKA.test(req.url())) hits.push(req.url())
    })
    page.on('pageerror', (err) => errors.push(err.message))

    for (const path of ['/', '/games', '/premium', '/profile', '/quiz', '/discover/mafiya-onlajn']) {
      await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(900)
    }

    expect(hits).toEqual([])
    expect(await page.locator('script[src*="metrika"], script[data-gnh-metrika]').count()).toBe(0)
    expect(await page.evaluate(() => typeof (window as unknown as { ym?: unknown }).ym)).toBe('undefined')
    const cookies = await context.cookies()
    expect(cookies.filter((c) => c.name.startsWith('_ym'))).toEqual([])
    expect(errors).toEqual([])
  })

  test('no Metrika banner or toggle in the UI', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem('gnh_legal_sheet_closed', '1')
        localStorage.setItem('gnh_web_welcome_v1', '1')
      } catch {
        /* ignore */
      }
    })
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)
    await expect(page.getByRole('dialog', { name: 'Согласие на аналитику' })).toHaveCount(0)
    await expect(page.getByText('Яндекс Метрика')).toHaveCount(0)
    await page.goto(`${BASE}/profile`, { waitUntil: 'networkidle' })
    await expect(page.getByText('Яндекс Метрика')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Метрик/ })).toHaveCount(0)
  })
})