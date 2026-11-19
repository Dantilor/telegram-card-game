const fs = require('fs')
const p = 'e2e/anon-premium.spec.ts'
let s = fs.readFileSync(p, 'utf8')
if (!s.includes('WEB purchase becomes Premium in Telegram after link')) {
  const marker = "test('telegram link mock restores premium from staging subscription'"
  if (!s.includes(marker)) { console.error('marker missing'); process.exit(1) }
  // append after the telegram link test block is hard; add new test before closing })
  const insert = `
  test('WEB purchase becomes Premium in Telegram after link (shared Premium)', async ({ playwright }) => {
    // Requires staging mock helpers; validates WEB→Telegram direction via complete-mock + initData-less /api/me is not enough.
    // Cover logic with server sharedPremium.test.ts; this E2E asserts link response exposes web_purchase source.
    const api = await playwright.request.newContext({ baseURL: API_URL })
    const ensure = await api.post('/api/web/session/ensure')
    expect(ensure.ok()).toBeTruthy()
    const csrf = (await api.storageState()).cookies.find((c) => c.name === 'gnh_csrf')?.value

    // Manual staging entitlement if endpoint exists; otherwise skip when staging lacks helper.
    const grant = await api.post('/api/web/dev/grant-premium', {
      headers: { 'X-CSRF-Token': csrf!, 'Content-Type': 'application/json' },
      data: { planId: 'premium_1m', secret: DEV_SECRET },
    })
    test.skip(!grant.ok(), 'staging WEB grant helper unavailable')

    const start = await api.post('/api/web/telegram-link/start', {
      headers: { 'X-CSRF-Token': csrf! },
    })
    expect(start.ok(), await start.text()).toBeTruthy()
    const { code } = await start.json()

    const tgId = USERS.free1 || 900001
    const complete = await api.post('/api/web/telegram-link/complete-mock', {
      data: { code, telegramId: tgId, secret: DEV_SECRET },
    })
    expect(complete.ok(), await complete.text()).toBeTruthy()
    const body = await complete.json()
    expect(body.linked).toBe(true)
    expect(body.sources || []).toEqual(expect.arrayContaining(['web_purchase']))
    expect(body.telegramPremium?.isPremium).toBe(true)

    await api.dispose()
  })

`
  // Insert before final closing of describe
  const idx = s.lastIndexOf('})')
  s = s.slice(0, idx) + insert + s.slice(idx)
  fs.writeFileSync(p, s)
  console.log('e2e appended')
} else {
  console.log('e2e exists')
}
