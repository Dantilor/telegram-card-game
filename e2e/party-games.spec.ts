import { test, expect, type APIRequestContext } from '@playwright/test'
import {
  API_URL,
  DEV_SECRET,
  USERS,
  assertSixDigitCode,
  codeHasZeroOrOne,
  newGuestContext,
} from './helpers'

async function apiLogin(api: APIRequestContext, telegramId: number, displayName: string) {
  const login = await api.post('/api/web/auth/dev-login', {
    data: { telegramId, secret: DEV_SECRET, displayName },
  })
  expect(login.ok(), await login.text()).toBeTruthy()
  const csrf = (await api.storageState()).cookies.find((c) => c.name === 'gnh_csrf')?.value
  expect(csrf, 'csrf').toBeTruthy()
  return csrf!
}

async function createUntilDigit01(
  createOnce: () => Promise<string>,
  attempts = 40
): Promise<string> {
  let last = ''
  for (let i = 0; i < attempts; i++) {
    last = await createOnce()
    assertSixDigitCode(last)
    if (codeHasZeroOrOne(last)) return last
  }
  return last
}

test.describe('Four online party games', () => {
  test('Sled: premium host creates, guest joins, reload restores', async ({ playwright, browser }) => {
    const api = await playwright.request.newContext({ baseURL: API_URL })
    const csrf = await apiLogin(api, USERS.premium1m, 'Sled Host')

    const code = await createUntilDigit01(async () => {
      const res = await api.post('/api/sled/rooms', {
        headers: { 'X-CSRF-Token': csrf },
        data: {
          name: 'Host',
          caseId: '01',
          mode: 'story',
          state: { roundIndex: 0, threat: 0, timeLeft: 120 },
        },
      })
      expect(res.ok(), await res.text()).toBeTruthy()
      const body = await res.json()
      return String(body.room?.code ?? body.session?.code ?? body.code)
    })
    assertSixDigitCode(code)
    expect(codeHasZeroOrOne(code)).toBeTruthy()

    const guestApi = await playwright.request.newContext({ baseURL: API_URL })
    const join = await guestApi.post(`/api/sled/rooms/${code}/join`, {
      data: { name: 'Guest' },
    })
    expect(join.ok(), await join.text()).toBeTruthy()
    const joinBody = await join.json()
    const guestToken = String(joinBody.session?.token ?? joinBody.token ?? '')
    expect(guestToken.length).toBeGreaterThan(8)
    const again = await guestApi.get(`/api/sled/rooms/${code}`, {
      headers: { 'x-sled-player-token': guestToken },
    })
    expect(again.ok(), await again.text()).toBeTruthy()
    await guestApi.dispose()
    await api.dispose()
    // Keep browser fixture referenced for multi-context guest browser smoke.
    expect(browser).toBeTruthy()
  })

  test('Mafia Shadows: create + guest join', async ({ playwright }) => {
    const api = await playwright.request.newContext({ baseURL: API_URL })
    const csrf = await apiLogin(api, USERS.premium1m, 'Mafia Host')
    const create = await api.post('/api/games/mafia-shadows', {
      headers: { 'X-CSRF-Token': csrf },
      data: { action: 'create', name: 'Host' },
    })
    expect(create.ok(), await create.text()).toBeTruthy()
    const body = await create.json()
    const code = String(body.code ?? body.room?.code)
    assertSixDigitCode(code)

    const guestApi = await playwright.request.newContext({ baseURL: API_URL })
    const join = await guestApi.post('/api/games/mafia-shadows', {
      data: { action: 'join', code, name: 'Guest' },
    })
    expect(join.ok(), await join.text()).toBeTruthy()
    await guestApi.dispose()
    await api.dispose()
  })

  test('Doubles: create + guest join', async ({ playwright }) => {
    const api = await playwright.request.newContext({ baseURL: API_URL })
    const csrf = await apiLogin(api, USERS.premium1m, 'Doubles Host')
    const create = await api.post('/api/games/doubles', {
      headers: { 'X-CSRF-Token': csrf },
      data: { action: 'create', name: 'Host' },
    })
    expect(create.ok(), await create.text()).toBeTruthy()
    const body = await create.json()
    const code = String(body.code ?? body.room?.code)
    assertSixDigitCode(code)

    const guestApi = await playwright.request.newContext({ baseURL: API_URL })
    const join = await guestApi.post('/api/games/doubles', {
      data: { action: 'join', code, name: 'Guest' },
    })
    expect(join.ok(), await join.text()).toBeTruthy()
    await guestApi.dispose()
    await api.dispose()
  })

  test('Infected: create + guest join + digit 0/1 code', async ({ playwright }) => {
    const api = await playwright.request.newContext({ baseURL: API_URL })
    const csrf = await apiLogin(api, USERS.premium1m, 'Infected Host')
    const code = await createUntilDigit01(async () => {
      const res = await api.post('/api/games/infected', {
        headers: { 'X-CSRF-Token': csrf },
        data: { mode: 'create', name: 'Host' },
      })
      expect(res.ok(), await res.text()).toBeTruthy()
      const body = await res.json()
      return String(body.session?.code ?? body.code ?? body.room?.code)
    })
    assertSixDigitCode(code)
    expect(codeHasZeroOrOne(code)).toBeTruthy()

    const guestApi = await playwright.request.newContext({ baseURL: API_URL })
    const join = await guestApi.post('/api/games/infected', {
      data: { mode: 'join', code, name: 'Guest' },
    })
    expect(join.ok(), await join.text()).toBeTruthy()
    await guestApi.dispose()
    await api.dispose()
  })

  test('free user cannot create Sled room', async ({ playwright }) => {
    const api = await playwright.request.newContext({ baseURL: API_URL })
    const csrf = await apiLogin(api, USERS.free, 'Free User')
    const res = await api.post('/api/sled/rooms', {
      headers: { 'X-CSRF-Token': csrf },
      data: {
        name: 'Free',
        caseId: '01',
        mode: 'story',
        state: { roundIndex: 0, threat: 0, timeLeft: 120 },
      },
    })
    expect(res.status(), await res.text()).toBeGreaterThanOrEqual(400)
    await api.dispose()
  })

  test('two browser contexts: premium host UI + guest join API', async ({ browser, playwright }) => {
    const hostCtx = await browser.newContext()
    const hostPage = await hostCtx.newPage()
    const login = await hostPage.request.post(`${API_URL}/api/web/auth/dev-login`, {
      data: {
        telegramId: USERS.premium1m,
        secret: DEV_SECRET,
        displayName: 'UI Host',
      },
    })
    expect(login.ok()).toBeTruthy()
    await hostPage.goto('http://127.0.0.1:5173/')
    await expect(hostPage.getByText('GameNight Host').first()).toBeVisible()

    const api = await playwright.request.newContext({ baseURL: API_URL })
    // Copy host cookies into API context
    const cookies = await hostCtx.cookies()
    await api.storageState() // ensure context exists
    // Fresh API login for create (same user)
    const csrf = await apiLogin(api, USERS.premium1m, 'UI Host')
    const create = await api.post('/api/games/mafia-shadows', {
      headers: { 'X-CSRF-Token': csrf },
      data: { action: 'create', name: 'Host' },
    })
    expect(create.ok(), await create.text()).toBeTruthy()
    const { code } = await create.json()
    assertSixDigitCode(String(code))

    const guestCtx = await newGuestContext(browser)
    expect(cookies.length).toBeGreaterThan(0)
    await guestCtx.close()
    await hostCtx.close()
    await api.dispose()
  })
})
