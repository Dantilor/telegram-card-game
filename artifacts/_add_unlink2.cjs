const fs = require('fs')
const p = 'server/src/routes/webAuth.ts'
let s = fs.readFileSync(p, 'utf8')
if (s.includes("/web/telegram-link/unlink")) {
  console.log('exists')
  process.exit(0)
}
const needle = "router.post('/web/telegram-link/complete'"
const idx = s.indexOf(needle)
if (idx < 0) { console.error('needle missing'); process.exit(1) }
const block = `
/**
 * POST /api/web/telegram-link/unlink (CSRF)
 * Revokes WEB↔Telegram link for this account. Does not alter original Telegram subscriptions
 * or web_purchase entitlements — only telegram_link WEB entitlements are expired.
 */
router.post('/web/telegram-link/unlink', requireWebSession(), async (req: AuthedRequest, res: Response) => {
  try {
    const auth = req.auth!
    if (!auth.webAccountId) {
      res.status(400).json({ error: 'Anonymous WEB account required', code: 'web_account_required' })
      return
    }
    const cookies = readCookies(req)
    const session = await findActiveSessionByToken(cookies[SESSION_COOKIE] || '')
    if (!session || !verifyCsrf(session, req.headers['x-csrf-token'] as string | undefined)) {
      res.status(403).json({ error: 'CSRF required', code: 'csrf_failed' })
      return
    }
    const ip = clientIpFromRequest(req)
    const limited = await consumeSharedRateLimit(
      'tg_link_unlink:' + auth.webAccountId + ':' + ip,
      8,
      10 * 60_000
    )
    if (!limited.ok) {
      res.status(429).json({ error: 'Too many unlink attempts', code: 'rate_limited' })
      return
    }

    const link = await query<{ telegram_id: string }>(
      'SELECT telegram_id::text AS telegram_id FROM web_telegram_links WHERE web_account_id = $1::uuid AND revoked_at IS NULL ORDER BY linked_at DESC NULLS LAST, id DESC LIMIT 1',
      [auth.webAccountId]
    )
    const telegramIdRaw = link.rows[0]?.telegram_id
    if (!telegramIdRaw) {
      res.status(200).json({ ok: true, linked: false, revoked: false })
      return
    }
    const telegramId = Number(telegramIdRaw)

    await withTransaction(async (tx) => {
      await tx.query(
        'UPDATE web_telegram_links SET revoked_at = now() WHERE web_account_id = $1::uuid AND revoked_at IS NULL',
        [auth.webAccountId]
      )
      await revokeTelegramLinkEntitlements({
        webAccountId: auth.webAccountId,
        telegramId: Number.isFinite(telegramId) ? telegramId : null,
        db: tx,
      })
    })

    const premium = await getWebAccountPremium(auth.webAccountId)
    res.status(200).json({
      ok: true,
      linked: false,
      revoked: true,
      isPremium: premium.isPremium,
      activeUntil: premium.activeUntil,
      sources: premium.sources,
    })
  } catch (e) {
    const { status, body } = errorPayload(e)
    res.status(status).json(body)
  }
})

`
s = s.slice(0, idx) + block + s.slice(idx)
fs.writeFileSync(p, s)
console.log('unlink inserted', fs.statSync(p).size)
