import { type APIRequestContext, type Browser, type BrowserContext, type Page, expect } from '@playwright/test'

export const BASE_URL = process.env.GNH_E2E_BASE_URL || 'http://127.0.0.1:5173'
/** Direct API (bypass Vite proxy) — party routers are verified here. */
export const API_URL = process.env.GNH_E2E_API_URL || 'http://127.0.0.1:3001'
export const DEV_SECRET = process.env.VITE_WEB_DEV_LOGIN_SECRET || 'local-e2e-dev-secret-not-for-prod'

export const USERS = {
  free: 900001,
  premium1m: 900002,
  lifetime: 900003,
  expired: 900004,
} as const

export async function devLogin(page: Page, telegramId: number, displayName: string) {
  const res = await page.request.post(`${BASE_URL}/api/web/auth/dev-login`, {
    data: { telegramId, secret: DEV_SECRET, displayName },
  })
  expect(res.ok(), `dev-login ${telegramId} status=${res.status()}`).toBeTruthy()
  await page.goto(`${BASE_URL}/`)
  await expect(page.getByText('GameNight Host').first()).toBeVisible({ timeout: 15_000 })
}

export async function readCsrf(context: BrowserContext): Promise<string> {
  const cookies = await context.cookies()
  const csrf = cookies.find((c) => c.name === 'gnh_csrf')?.value
  expect(csrf, 'gnh_csrf cookie').toBeTruthy()
  return csrf!
}

/** Cookie header for API host (port differs from Vite; Playwright may not auto-attach). */
export async function cookieHeader(context: BrowserContext): Promise<string> {
  const cookies = await context.cookies()
  return cookies.map((c) => `${c.name}=${c.value}`).join('; ')
}

export async function expectSessionCookies(context: BrowserContext) {
  const cookies = await context.cookies()
  expect(cookies.some((c) => c.name === 'gnh_sid' && c.httpOnly)).toBeTruthy()
  expect(cookies.some((c) => c.name === 'gnh_csrf')).toBeTruthy()
}

export function isPremiumPayload(body: Record<string, unknown>): boolean {
  return Boolean(body.isPremium ?? body.active ?? body.premium)
}

export async function apiGet(request: APIRequestContext, path: string) {
  const res = await request.get(`${BASE_URL}${path}`)
  return res
}

export async function apiPost(
  request: APIRequestContext,
  path: string,
  body: unknown,
  csrf?: string
) {
  return request.post(`${BASE_URL}${path}`, {
    data: body,
    headers: csrf ? { 'X-CSRF-Token': csrf } : undefined,
  })
}

export async function newGuestContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext()
}

export function assertSixDigitCode(code: string) {
  expect(code).toMatch(/^[0-9]{6}$/)
}

export function codeHasZeroOrOne(code: string): boolean {
  return /[01]/.test(code)
}
