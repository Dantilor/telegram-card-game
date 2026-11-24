import { expect, test, type Page } from '@playwright/test'
import { BASE_URL } from './helpers'

const STATEMENT = 'Принимаю Публичную оферту Premium'
const PLANS = [
  { id: 'premium_web_1m', title: 'Premium на 30 дней', priceRub: 259, durationDays: 30, audience: 'web' },
  { id: 'premium_web_3m', title: 'Premium на 90 дней', priceRub: 399, durationDays: 90, audience: 'web' },
  { id: 'premium_web_lifetime', title: 'Premium навсегда', priceRub: 990, durationDays: 36500, audience: 'web' },
]

const OFFER = {
  id: 'offer',
  title: 'Публичная оферта',
  version: '2026-10-20.1',
  sha256: 'a'.repeat(64),
  kind: 'offer',
  scope: 'checkout',
  documentDate: '2026-10-20',
  active: true,
  activatedAt: null,
  requiresIndividualDetails: false,
  confirmation: { available: true, mode: 'statement', statement: STATEMENT, channel: 'none' },
  links: { json: '', html: '', versionJson: '', versionHtml: '' },
  versions: [],
  blocks: [{ type: 'paragraph', text: 'Текст оферты.' }],
}

async function mockCheckoutApis(page: Page) {
  await page.route('**/api/plans**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, plans: PLANS }),
    })
  })
  await page.route('**/api/legal/documents/offer**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(OFFER),
    })
  })
  await page.route('**/api/legal/me**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ agreement: null, consents: [], offerAcceptances: [] }),
    })
  })
  await page.route('**/api/legal/documents/**', async (route) => {
    if (route.request().url().includes('/offer')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(OFFER) })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...OFFER, id: 'privacy', kind: 'privacy', confirmation: { available: false } }),
    })
  })
}

async function openRealCheckout(page: Page) {
  await page.goto(`${BASE_URL}/premium?focus=plans`)
  await expect(page.getByText(/ВАШ ПРОПУСК|тариф|Premium/i).first()).toBeVisible({ timeout: 30_000 })
  const later = page.getByRole('button', { name: /Позже/i })
  if (await later.count()) {
    await later.click()
  }
  const choose30 = page.locator('button[data-action="choose-plan"][data-plan="premium_web_1m"]')
  await expect(choose30).toBeVisible({ timeout: 20_000 })
  await choose30.click()
  await expect(page.getByTestId('premium-checkout')).toBeVisible({ timeout: 20_000 })
}

async function assertButtonsReachable(page: Page) {
  const checkout = page.getByTestId('premium-checkout')
  const scroll = page.getByTestId('premium-checkout-scroll')
  const buy = page.getByRole('button', { name: /Оплатить Premium/i })
  const emailLogin = page.getByRole('button', { name: /Войти по email/i })
  const email = page.getByPlaceholder('name@example.com')
  const offer = page.getByRole('checkbox', { name: STATEMENT })

  await expect(checkout).toBeVisible()
  await expect(page.getByRole('heading', { name: /Оформление Premium/i })).toBeVisible()
  await expect(page.getByText(/259|399|990/).first()).toBeVisible()
  await expect(offer).toBeVisible()
  await expect(email).toBeVisible()
  await expect(page.getByRole('button', { name: /Публичная оферта/i })).toBeVisible()
  await expect(buy).toBeVisible()
  await expect(emailLogin).toBeVisible()

  // Dock must be outside the scroll owner
  const structure = await page.evaluate(() => {
    const dock = document.querySelector('.premium-overlay__dock--checkout')
    const sc = document.querySelector('[data-testid="premium-checkout-scroll"]')
    return {
      dockInsideScroll: Boolean(sc && dock && sc.contains(dock)),
      scrollOverflowY: sc ? getComputedStyle(sc).overflowY : null,
    }
  })
  expect(structure.dockInsideScroll).toBe(false)
  expect(['auto', 'scroll', 'overlay']).toContain(structure.scrollOverflowY)

  // Scroll content to end; footer must remain in viewport
  await scroll.evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })
  await expect(buy).toBeVisible()
  await expect(emailLogin).toBeVisible()

  const boxes = await page.evaluate(() => {
    const vv = window.visualViewport
    const vh = vv?.height ?? window.innerHeight
    const buyEl = document.querySelector('.premium-overlay__dock--checkout .premium-overlay__btn--buy') as HTMLElement | null
    const restoreEl = document.querySelector('.premium-overlay__dock--checkout .premium-overlay__btn--restore') as HTMLElement | null
    const card = document.querySelector('[data-testid="premium-checkout"]') as HTMLElement | null
    const sc = document.querySelector('[data-testid="premium-checkout-scroll"]') as HTMLElement | null
    const last = sc?.lastElementChild as HTMLElement | null
    const buyBox = buyEl?.getBoundingClientRect()
    const restoreBox = restoreEl?.getBoundingClientRect()
    const cardBox = card?.getBoundingClientRect()
    const lastBox = last?.getBoundingClientRect()
    return {
      vh,
      buyTop: buyBox?.top ?? -1,
      buyBottom: buyBox?.bottom ?? -1,
      restoreBottom: restoreBox?.bottom ?? -1,
      cardBottom: cardBox?.bottom ?? -1,
      lastBottom: lastBox?.bottom ?? -1,
      overflowX: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > Math.max(document.documentElement.clientWidth, document.body.clientWidth) + 1,
      cardOverflow: card ? getComputedStyle(card).overflow : null,
      scrollCan: sc ? sc.scrollHeight - sc.clientHeight : 0,
    }
  })

  expect(boxes.buyBottom).toBeGreaterThan(0)
  expect(boxes.buyBottom).toBeLessThanOrEqual(boxes.vh + 1)
  expect(boxes.restoreBottom).toBeGreaterThan(0)
  expect(boxes.restoreBottom).toBeLessThanOrEqual(boxes.vh + 2)
  expect(boxes.restoreBottom).toBeLessThanOrEqual(boxes.cardBottom + 1)
  expect(boxes.overflowX).toBe(false)

  // After scrolling, last content should sit above the sticky dock (not covered forever)
  if (boxes.scrollCan > 8 && boxes.lastBottom > 0) {
    expect(boxes.lastBottom).toBeLessThanOrEqual(boxes.buyTop + 2)
  }

  // Enable CTA with real form fields, then prove hit-testing works.
  await offer.check()
  await email.fill('buyer@example.test')
  await expect(buy).toBeEnabled({ timeout: 10_000 })
  await buy.click({ trial: true })
  await emailLogin.click({ trial: true })
}

test.describe('Premium checkout reachability', () => {
  test.beforeEach(async ({ page }) => {
    await mockCheckoutApis(page)
  })

  test('desktop 1366x768: CTAs reachable with real checkout', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await openRealCheckout(page)
    await assertButtonsReachable(page)
    await page.screenshot({ path: 'test-results/premium-checkout-desktop-1366.png', fullPage: false })
  })

  test('iPhone 390x844: sticky footer CTAs reachable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openRealCheckout(page)
    await assertButtonsReachable(page)
    await page.screenshot({ path: 'test-results/premium-checkout-iphone-390.png', fullPage: false })
  })

  test('iPhone SE 375x667: scroll + sticky footer', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await openRealCheckout(page)
    await assertButtonsReachable(page)
    await page.screenshot({ path: 'test-results/premium-checkout-iphone-se-375.png', fullPage: false })
  })

  test('low laptop 1280x720: no clipped buy button', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await openRealCheckout(page)
    await assertButtonsReachable(page)
  })
})