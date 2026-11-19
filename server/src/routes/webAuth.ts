import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import { ensureUser } from '../services/subscriptions.js'
import { webPublicOrigin, sessionTtlMs } from '../auth/config.js'
import {
  SESSION_COOKIE,
  clearSessionCookies,
  readCookies,
  setSessionCookies,
} from '../auth/cookies.js'
import { requireWebSession, type AuthedRequest } from '../auth/middleware.js'
import { resolveAuth } from '../auth/resolveAuth.js'
import { completeTelegramOidcLogin, startTelegramOidcLogin } from '../auth/telegramOidc.js'
import {
  createWebSession,
  revokeSessionByToken,
  verifyCsrf,
  findActiveSessionByToken,
} from '../auth/webSession.js'
import {
  countRecentAnonAccounts,
  createAnonymousWebAccountSession,
  getTelegramPremium,
  getWebAccountContact,
  getWebAccountPremium,
  grantWebEntitlement,
  revokeTelegramLinkEntitlements,
} from '../auth/webAccounts.js'
import {
  completeEmailRecover,
  startEmailBind,
  startEmailRecover,
  verifyEmailBind,
} from '../auth/webEmailOtp.js'
import { isWebOwnerAllowed, webFeatureEnabled } from '../config/runtimeFlags.js'
import { randomNumericCode, sha256Hex } from '../auth/cryptoTokens.js'
import { clientIpFromRequest, consumeSharedRateLimit } from '../auth/rateLimit.js'
import { query } from '../db.js'
import { withTransaction } from '../legal/runtime.js'

const router = Router()

/** Telegram OIDC is not a standalone WEB login. Opt-in only for legacy unit tests. */
function oidcWebLoginEnabled(): boolean {
  return process.env.WEB_OIDC_LOGIN_ENABLED === '1' || process.env.WEB_OIDC_LOGIN_ENABLED === 'true'
}

const LINK_CODE_RE = /^\d{8}$/

function errorPayload(e: unknown): { status: number; body: Record<string, unknown> } {
  const err = e as Error & { status?: number; code?: string }
  const status = err.status ?? 500
  return {
    status,
    body: {
      error: status === 401 ? 'Unauthorized' : status === 503 ? 'Service unavailable' : 'Auth error',
      code: err.code ?? (status === 401 ? 'unauthorized' : 'auth_error'),
      message: status >= 500 ? undefined : err.message,
    },
  }
}

function safeReturnPath(returnTo: string | null | undefined): string {
  if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//')) return '/'
  return returnTo
}

function devLoginEnabled(): boolean {
  // Hard-disable in any production-like environment regardless of WEB_DEV_LOGIN_ENABLED.
  if (process.env.NODE_ENV === 'production') return false
  if (process.env.GNH_PRODUCTION === '1' || process.env.GNH_PRODUCTION === 'true') return false
  if (process.env.RENDER === 'true' || Boolean(process.env.RENDER_EXTERNAL_URL)) return false
  if (process.env.TIMEWEB === '1' || process.env.TIMEWEB === 'true') return false
  return process.env.WEB_DEV_LOGIN_ENABLED === '1' || process.env.WEB_DEV_LOGIN_ENABLED === 'true'
}

/**
 * Start Telegram OIDC Authorization Code + PKCE.
 * GET /api/web/auth/telegram/start?return_to=/
 */
router.get('/web/auth/telegram/start', async (req: Request, res: Response) => {
  try {
    if (!webFeatureEnabled()) {
      res.status(503).json({ error: 'WEB login disabled', code: 'web_disabled' })
      return
    }
    if (!oidcWebLoginEnabled()) {
      const origin = webPublicOrigin()
      const wantsRedirect =
        req.query.redirect === '1' ||
        req.query.redirect === 'true' ||
        (typeof req.headers.accept === 'string' && req.headers.accept.includes('text/html'))
      if (wantsRedirect && origin) {
        res.redirect(302, `${origin}/?error=${encodeURIComponent('oidc_login_disabled')}`)
        return
      }
      res.status(403).json({
        error: 'Telegram OIDC login disabled',
        code: 'oidc_login_disabled',
        message: 'Используйте анонимный WEB-доступ или восстановление Premium из Telegram Mini App.',
      })
      return
    }
    const returnTo = typeof req.query.return_to === 'string' ? req.query.return_to : null
    const started = await startTelegramOidcLogin({ returnTo })
    const wantsRedirect =
      req.query.redirect === '1' ||
      req.query.redirect === 'true' ||
      (typeof req.headers.accept === 'string' && req.headers.accept.includes('text/html'))

    if (wantsRedirect) {
      res.redirect(302, started.authorizationUrl)
      return
    }
    res.status(200).json({
      ok: true,
      authorizationUrl: started.authorizationUrl,
      state: started.state,
    })
  } catch (e) {
    const { status, body } = errorPayload(e)
    res.status(status).json(body)
  }
})

/**
 * OIDC callback. Exchanges code, verifies id_token, creates WEB session cookies.
 * GET /api/web/auth/telegram/callback?code=&state=
 */
router.get('/web/auth/telegram/callback', async (req: Request, res: Response) => {
  try {
    const code = typeof req.query.code === 'string' ? req.query.code : ''
    const state = typeof req.query.state === 'string' ? req.query.state : ''
    const oidcError = typeof req.query.error === 'string' ? req.query.error : ''
    if (oidcError) {
      const origin = webPublicOrigin()
      if (origin) {
        res.redirect(302, `${origin}/login?error=${encodeURIComponent(oidcError)}`)
        return
      }
      res.status(401).json({ error: 'Unauthorized', code: 'oidc_denied', message: oidcError })
      return
    }

    if (!webFeatureEnabled()) {
      res.status(503).json({ error: 'WEB login disabled', code: 'web_disabled' })
      return
    }
    if (!oidcWebLoginEnabled()) {
      const origin = webPublicOrigin()
      if (origin) {
        res.redirect(302, `${origin}/?error=${encodeURIComponent('oidc_login_disabled')}`)
        return
      }
      res.status(403).json({ error: 'Telegram OIDC login disabled', code: 'oidc_login_disabled' })
      return
    }

    const completed = await completeTelegramOidcLogin({ code, state })
    if (!isWebOwnerAllowed(completed.telegramId)) {
      const origin = webPublicOrigin()
      if (origin) {
        res.redirect(302, `${origin}/login?error=${encodeURIComponent('owner_only')}`)
        return
      }
      res.status(403).json({ error: 'Forbidden', code: 'owner_only' })
      return
    }
    await ensureUser(completed.telegramId)

    const session = await createWebSession(completed.telegramId, {
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
      profile: {
        displayName: completed.profile.name ?? null,
        username: completed.profile.preferredUsername ?? null,
        pictureUrl: completed.profile.picture ?? null,
      },
    })
    const maxAgeSec = Math.floor(sessionTtlMs() / 1000)
    setSessionCookies(res, {
      sessionToken: session.sessionToken,
      csrfToken: session.csrfToken,
      maxAgeSec,
    })

    const origin = webPublicOrigin()
    const path = safeReturnPath(completed.returnTo)
    if (origin) {
      res.redirect(302, `${origin}${path}`)
      return
    }

    res.status(200).json({
      ok: true,
      telegramId: completed.telegramId,
      source: 'web_session',
      returnTo: path,
      profile: completed.profile,
    })
  } catch (e) {
    const { status, body } = errorPayload(e)
    const origin = webPublicOrigin()
    if (origin && status === 401) {
      res.redirect(302, `${origin}/login?error=${encodeURIComponent(String(body.code ?? 'auth_error'))}`)
      return
    }
    res.status(status).json(body)
  }
})

/**
 * Local/dev only: create a WEB session without Telegram OIDC.
 * Disabled in production. Requires WEB_DEV_LOGIN_ENABLED=1 and WEB_DEV_LOGIN_SECRET.
 */
router.post('/web/auth/dev-login', async (req: Request, res: Response) => {
  if (!devLoginEnabled()) {
    res.status(404).json({ error: 'Not found' })
    return
  }
  const secret = process.env.WEB_DEV_LOGIN_SECRET ?? ''
  const parsed = z
    .object({
      telegramId: z.number().int().positive(),
      secret: z.string().min(8),
      displayName: z.string().max(120).optional(),
      username: z.string().max(64).optional(),
    })
    .safeParse(req.body)
  if (!parsed.success || !secret || parsed.data.secret !== secret) {
    res.status(401).json({ error: 'Unauthorized', code: 'dev_login_denied' })
    return
  }

  try {
    await ensureUser(parsed.data.telegramId)
    const session = await createWebSession(parsed.data.telegramId, {
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
      profile: {
        displayName: parsed.data.displayName ?? 'Dev Host',
        username: parsed.data.username ?? null,
        pictureUrl: null,
      },
    })
    setSessionCookies(res, {
      sessionToken: session.sessionToken,
      csrfToken: session.csrfToken,
      maxAgeSec: Math.floor(sessionTtlMs() / 1000),
    })
    res.status(200).json({
      ok: true,
      telegramId: parsed.data.telegramId,
      source: 'web_session',
      dev: true,
    })
  } catch (e) {
    const { status, body } = errorPayload(e)
    res.status(status).json(body)
  }
})

/** Logout: revoke session + clear cookies. Requires X-CSRF-Token matching the session. */
router.post('/web/auth/logout', async (req: Request, res: Response) => {
  try {
    const cookies = readCookies(req)
    const sessionToken = cookies[SESSION_COOKIE]
    if (!sessionToken) {
      clearSessionCookies(res)
      res.status(200).json({ ok: true })
      return
    }

    const session = await findActiveSessionByToken(sessionToken)
    if (session) {
      const headerCsrf =
        typeof req.headers['x-csrf-token'] === 'string' ? req.headers['x-csrf-token'].trim() : ''
      if (!verifyCsrf(session, headerCsrf)) {
        res.status(403).json({ error: 'CSRF validation failed', code: 'csrf_failed' })
        return
      }
      await revokeSessionByToken(sessionToken)
    }

    clearSessionCookies(res)
    res.status(200).json({ ok: true })
  } catch (e) {
    const { status, body } = errorPayload(e)
    res.status(status).json(body)
  }
})

/**
 * WEB session profile endpoint.
 * GET /api/web/session/me
 */
router.get('/web/session/me', requireWebSession(), async (req: AuthedRequest, res: Response) => {
  const cookies = readCookies(req)
  const sessionToken = cookies[SESSION_COOKIE]
  const session = sessionToken ? await findActiveSessionByToken(sessionToken) : null
  const auth = req.auth!
  let premium: { isPremium: boolean; activeUntil: string | null; sources?: string[] } | undefined
  let email: string | null = null
  let emailVerified = false
  if (auth.webAccountId) {
    const status = await getWebAccountPremium(auth.webAccountId)
    premium = {
      isPremium: status.isPremium,
      activeUntil: status.activeUntil,
      sources: status.sources,
    }
    const contact = await getWebAccountContact(auth.webAccountId)
    email = contact.email
    emailVerified = contact.emailVerified
  }
  res.status(200).json({
    ok: true,
    telegramId: auth.telegramId ?? null,
    webAccountId: auth.webAccountId ?? null,
    source: auth.source,
    sessionId: auth.sessionId,
    displayName: session?.display_name ?? null,
    username: session?.username ?? null,
    pictureUrl: session?.picture_url ?? null,
    email,
    emailVerified,
    premium,
  })
})

/**
 * Ensure anonymous WEB account + cookie session (no registration).
 * POST /api/web/session/ensure
 * Idempotent when a valid cookie already exists.
 */
router.post('/web/session/ensure', async (req: Request, res: Response) => {
  try {
    if (!webFeatureEnabled()) {
      res.status(503).json({ error: 'WEB auth disabled', code: 'web_disabled' })
      return
    }
    const existing = await resolveAuth(req, { requireCsrfForWeb: false })
    if (existing?.webAccountId || existing?.telegramId) {
      res.status(200).json({
        ok: true,
        created: false,
        webAccountId: existing.webAccountId ?? null,
        telegramId: existing.telegramId ?? null,
        source: existing.source,
      })
      return
    }

    // Soft rate limit: global create burst (staging/local protection).
    const recent = await countRecentAnonAccounts(60_000)
    const maxPerMinute = Number(process.env.WEB_ANON_CREATE_MAX_PER_MIN || 120)
    if (recent >= maxPerMinute) {
      res.status(429).json({ error: 'Too many anonymous sessions', code: 'rate_limited' })
      return
    }

    const created = await createAnonymousWebAccountSession({
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
    })
    const maxAgeSec = Math.floor(sessionTtlMs() / 1000)
    setSessionCookies(res, {
      sessionToken: created.sessionToken,
      csrfToken: created.csrfToken,
      maxAgeSec,
    })
    res.status(200).json({
      ok: true,
      created: true,
      webAccountId: created.webAccountId,
      source: 'web_account',
      expiresAt: created.expiresAt.toISOString(),
    })
  } catch (e) {
    const { status, body } = errorPayload(e)
    res.status(status).json(body)
  }
})

/**
 * Start Telegram Premium restore challenge for current WEB account.
 * POST /api/web/telegram-link/start  (CSRF)
 * Returns a short one-time code the user confirms from Mini App (staging/E2E may echo code when WEB_TELEGRAM_LINK_ECHO=1).
 */
router.post('/web/telegram-link/start', requireWebSession(), async (req: AuthedRequest, res: Response) => {
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
      `tg_link_start:${auth.webAccountId}:${ip}`,
      5,
      10 * 60_000
    )
    if (!limited.ok) {
      res.status(429).json({ error: 'Too many codes', code: 'rate_limited' })
      return
    }
    // Always return code to the authenticated WEB session that created it (pairing UX).
    // Stored only as hash; single-use; short TTL; rate-limited.
    const code = randomNumericCode(8)
    const expiresAt = new Date(Date.now() + 10 * 60_000)
    await query(
      `INSERT INTO web_telegram_link_challenges (web_account_id, code_hash, expires_at)
       VALUES ($1::uuid, $2, $3)`,
      [auth.webAccountId, sha256Hex(code), expiresAt.toISOString()]
    )
    res.status(200).json({
      ok: true,
      code,
      expiresAt: expiresAt.toISOString(),
      instruction:
        'Откройте GameNight Host в Telegram Mini App → раздел «Привязать WEB» (/link-web) и введите этот код. Код действует 10 минут.',
    })
  } catch (e) {
    const { status, body } = errorPayload(e)
    res.status(status).json(body)
  }
})

/**
 * GET /api/web/telegram-link/status — poll link + Premium after WEB restore code.
 */
router.get('/web/telegram-link/status', requireWebSession(), async (req: AuthedRequest, res: Response) => {
  try {
    const auth = req.auth!
    if (!auth.webAccountId) {
      res.status(400).json({ error: 'Anonymous WEB account required', code: 'web_account_required' })
      return
    }
    const link = await query<{ telegram_id: string; linked_at: Date }>(
      `SELECT telegram_id::text AS telegram_id, linked_at
         FROM web_telegram_links
        WHERE web_account_id = $1::uuid AND revoked_at IS NULL
        ORDER BY linked_at DESC NULLS LAST, id DESC
        LIMIT 1`,
      [auth.webAccountId]
    )
    const pending = await query<{ expires_at: Date }>(
      `SELECT expires_at
         FROM web_telegram_link_challenges
        WHERE web_account_id = $1::uuid
          AND consumed_at IS NULL
          AND expires_at > now()
        ORDER BY id DESC
        LIMIT 1`,
      [auth.webAccountId]
    )
    const premium = await getWebAccountPremium(auth.webAccountId)
    const row = link.rows[0]
    res.status(200).json({
      ok: true,
      linked: Boolean(row),
      telegramId: row?.telegram_id ?? null,
      linkedAt: row?.linked_at ? new Date(row.linked_at).toISOString() : null,
      pendingChallengeExpiresAt: pending.rows[0]?.expires_at
        ? new Date(pending.rows[0].expires_at).toISOString()
        : null,
      isPremium: premium.isPremium,
      activeUntil: premium.activeUntil,
      sources: premium.sources,
    })
  } catch (e) {
    const { status, body } = errorPayload(e)
    res.status(status).json(body)
  }
})

/**
 * Complete Telegram link from Mini App initData + code.
 * POST /api/web/telegram-link/complete  (initData auth, body: { code })
 */

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

router.post('/web/telegram-link/complete', async (req: Request, res: Response) => {
  try {
    const auth = await resolveAuth(req)
    if (!auth?.telegramId || auth.source !== 'telegram_init_data') {
      res.status(401).json({ error: 'Telegram Mini App auth required', code: 'telegram_init_required' })
      return
    }
    const ip = clientIpFromRequest(req)
    const ipLimited = await consumeSharedRateLimit(`tg_link_complete_ip:${ip}`, 20, 10 * 60_000)
    if (!ipLimited.ok) {
      res.status(429).json({ error: 'Too many attempts', code: 'rate_limited' })
      return
    }
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : ''
    if (!LINK_CODE_RE.test(code)) {
      res.status(400).json({ error: 'Invalid code', code: 'invalid_code' })
      return
    }

    const result = await withTransaction(async (tx) => {
      const challenge = await tx.query<{
        id: number
        web_account_id: string
        attempts: number
        expires_at: Date
        consumed_at: Date | null
      }>(
        `SELECT id, web_account_id, attempts, expires_at, consumed_at
           FROM web_telegram_link_challenges
          WHERE code_hash = $1
          ORDER BY id DESC
          LIMIT 1
          FOR UPDATE`,
        [sha256Hex(code)]
      )
      const row = challenge.rows[0]
      if (!row || row.consumed_at || new Date(row.expires_at).getTime() <= Date.now()) {
        const err = new Error('Code expired or unknown') as Error & { status?: number; code?: string }
        err.status = 400
        err.code = 'code_invalid'
        throw err
      }
      if (row.attempts >= 5) {
        const err = new Error('Too many attempts') as Error & { status?: number; code?: string }
        err.status = 429
        err.code = 'rate_limited'
        throw err
      }
      await tx.query(`UPDATE web_telegram_link_challenges SET attempts = attempts + 1 WHERE id = $1`, [
        row.id,
      ])
      const consumed = await tx.query<{ id: number }>(
        `UPDATE web_telegram_link_challenges SET consumed_at = now()
          WHERE id = $1 AND consumed_at IS NULL
          RETURNING id`,
        [row.id]
      )
      if (!consumed.rows[0]) {
        const err = new Error('Code already used') as Error & { status?: number; code?: string }
        err.status = 400
        err.code = 'code_invalid'
        throw err
      }

      await tx.query(
        `UPDATE web_telegram_links SET revoked_at = now()
          WHERE (telegram_id = $1::bigint OR web_account_id = $2::uuid) AND revoked_at IS NULL`,
        [auth.telegramId, row.web_account_id]
      )
      await revokeTelegramLinkEntitlements({ telegramId: auth.telegramId, db: tx })
      await revokeTelegramLinkEntitlements({ webAccountId: row.web_account_id, db: tx })
      await tx.query(
        `INSERT INTO web_telegram_links (web_account_id, telegram_id) VALUES ($1::uuid, $2::bigint)`,
        [row.web_account_id, auth.telegramId]
      )

      const sub = await tx.query<{ active_until: Date; plan_id: string }>(
        `SELECT active_until, plan_id FROM subscriptions
          WHERE telegram_id = $1::bigint AND active_until > now()
          ORDER BY active_until DESC LIMIT 1`,
        [auth.telegramId]
      )
      if (sub.rows[0]) {
        await grantWebEntitlement({
          webAccountId: row.web_account_id,
          planId: sub.rows[0].plan_id || 'premium_1m',
          activeUntil: new Date(sub.rows[0].active_until),
          source: 'telegram_link',
          linkedTelegramId: auth.telegramId,
          db: tx,
        })
      }
      return {
        webAccountId: row.web_account_id,
        premiumRestored: Boolean(sub.rows[0]),
        activeUntil: sub.rows[0]?.active_until
          ? new Date(sub.rows[0].active_until).toISOString()
          : null,
      }
    })

    const webPremium = await getWebAccountPremium(result.webAccountId)
    const tgPremium = await getTelegramPremium(auth.telegramId!)
    const activeUntil =
      webPremium.activeUntil && tgPremium.activeUntil
        ? new Date(webPremium.activeUntil) > new Date(tgPremium.activeUntil)
          ? webPremium.activeUntil
          : tgPremium.activeUntil
        : webPremium.activeUntil || tgPremium.activeUntil
    const sources = [...new Set([...webPremium.sources, ...tgPremium.sources])]
    res.status(200).json({
      ok: true,
      linked: true,
      telegramId: auth.telegramId!,
      premiumRestored: result.premiumRestored || webPremium.sources.includes('web_purchase'),
      isPremium: Boolean(activeUntil && new Date(activeUntil) > new Date()),
      activeUntil,
      sources,
      webPremium,
      telegramPremium: tgPremium,
    })
  } catch (e) {
    const { status, body } = errorPayload(e)
    res.status(status).json(body)
  }
})

/**
 * Staging/E2E: complete Telegram link without Mini App initData.
 * POST /api/web/telegram-link/complete-mock { code, telegramId, secret }
 * Enabled only when WEB_TELEGRAM_LINK_ECHO=1 and not production.
 */
router.post('/web/telegram-link/complete-mock', async (req: Request, res: Response) => {
  try {
    if (process.env.NODE_ENV === 'production' || process.env.WEB_TELEGRAM_LINK_ECHO !== '1') {
      res.status(404).json({ error: 'Not found', code: 'not_found' })
      return
    }
    const secret = typeof req.body?.secret === 'string' ? req.body.secret : ''
    const expected = process.env.WEB_DEV_LOGIN_SECRET || ''
    if (!expected || secret !== expected) {
      res.status(401).json({ error: 'Unauthorized', code: 'unauthorized' })
      return
    }
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : ''
    const telegramId = Number(req.body?.telegramId)
    if (!LINK_CODE_RE.test(code) || !Number.isFinite(telegramId) || telegramId <= 0) {
      res.status(400).json({ error: 'Invalid payload', code: 'invalid_body' })
      return
    }
    const challenge = await query<{
      id: number
      web_account_id: string
      attempts: number
      expires_at: Date
      consumed_at: Date | null
    }>(
      `SELECT id, web_account_id, attempts, expires_at, consumed_at
         FROM web_telegram_link_challenges
        WHERE code_hash = $1
        ORDER BY id DESC
        LIMIT 1`,
      [sha256Hex(code)]
    )
    const row = challenge.rows[0]
    if (!row || row.consumed_at || new Date(row.expires_at).getTime() <= Date.now()) {
      res.status(400).json({ error: 'Code expired or unknown', code: 'code_invalid' })
      return
    }
    await query(
      `UPDATE web_telegram_link_challenges SET consumed_at = now() WHERE id = $1 AND consumed_at IS NULL`,
      [row.id]
    )
    await ensureUser(telegramId)
    await query(
      `UPDATE web_telegram_links SET revoked_at = now()
        WHERE (telegram_id = $1::bigint OR web_account_id = $2::uuid) AND revoked_at IS NULL`,
      [telegramId, row.web_account_id]
    )
    await revokeTelegramLinkEntitlements({ telegramId })
    await revokeTelegramLinkEntitlements({ webAccountId: row.web_account_id })
    await query(
      `INSERT INTO web_telegram_links (web_account_id, telegram_id) VALUES ($1::uuid, $2::bigint)`,
      [row.web_account_id, telegramId]
    )
    const sub = await query<{ active_until: Date; plan_id: string }>(
      `SELECT active_until, plan_id FROM subscriptions
        WHERE telegram_id = $1::bigint AND active_until > now()
        ORDER BY active_until DESC LIMIT 1`,
      [telegramId]
    )
    if (sub.rows[0]) {
      await grantWebEntitlement({
        webAccountId: row.web_account_id,
        planId: sub.rows[0].plan_id || 'premium_1m',
        activeUntil: new Date(sub.rows[0].active_until),
        source: 'telegram_link',
        linkedTelegramId: telegramId,
      })
    }
    const webPremium = await getWebAccountPremium(row.web_account_id)
    const tgPremium = await getTelegramPremium(telegramId)
    const activeUntil =
      webPremium.activeUntil && tgPremium.activeUntil
        ? new Date(webPremium.activeUntil) > new Date(tgPremium.activeUntil)
          ? webPremium.activeUntil
          : tgPremium.activeUntil
        : webPremium.activeUntil || tgPremium.activeUntil
    const sources = [...new Set([...webPremium.sources, ...tgPremium.sources])]
    res.status(200).json({
      ok: true,
      linked: true,
      telegramId: telegramId,
      premiumRestored: Boolean(sub.rows[0]) || webPremium.sources.includes('web_purchase'),
      isPremium: Boolean(activeUntil && new Date(activeUntil) > new Date()),
      activeUntil,
      sources,
      webPremium,
      telegramPremium: tgPremium,
    })
  } catch (e) {
    const { status, body } = errorPayload(e)
    res.status(status).json(body)
  }
})

/**
 * Optional: bind email to current WEB account (purchase protection).
 * POST /api/web/email/bind/start { email }  CSRF
 */
router.post('/web/email/bind/start', requireWebSession(), async (req: AuthedRequest, res: Response) => {
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
    const email = typeof req.body?.email === 'string' ? req.body.email : ''
    const started = await startEmailBind({
      webAccountId: auth.webAccountId,
      email,
      ip: clientIpFromRequest(req),
    })
    res.status(200).json({
      ok: true,
      expiresAt: started.expiresAt.toISOString(),
      ...(started.echoCode ? { code: started.echoCode } : {}),
    })
  } catch (e) {
    const { status, body } = errorPayload(e)
    res.status(status).json(body)
  }
})

/**
 * POST /api/web/email/bind/verify { email, code } CSRF
 */
router.post('/web/email/bind/verify', requireWebSession(), async (req: AuthedRequest, res: Response) => {
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
    const email = typeof req.body?.email === 'string' ? req.body.email : ''
    const code = typeof req.body?.code === 'string' ? req.body.code : ''
    const verified = await verifyEmailBind({ webAccountId: auth.webAccountId, email, code })
    res.status(200).json({ ok: true, email: verified.emailNormalized })
  } catch (e) {
    const { status, body } = errorPayload(e)
    res.status(status).json(body)
  }
})

/**
 * POST /api/web/email/recover/start { email } — no auth; anti-enumeration
 */
router.post('/web/email/recover/start', async (req: Request, res: Response) => {
  try {
    if (!webFeatureEnabled()) {
      res.status(503).json({ error: 'WEB auth disabled', code: 'web_disabled' })
      return
    }
    const email = typeof req.body?.email === 'string' ? req.body.email : ''
    const started = await startEmailRecover({ email, ip: clientIpFromRequest(req) })
    res.status(200).json({
      ok: true,
      expiresAt: started.expiresAt,
      ...(started.echoCode ? { code: started.echoCode } : {}),
    })
  } catch (e) {
    const { status, body } = errorPayload(e)
    res.status(status).json(body)
  }
})

/**
 * POST /api/web/email/recover/complete { email, code } — sets new session cookies
 */
router.post('/web/email/recover/complete', async (req: Request, res: Response) => {
  try {
    if (!webFeatureEnabled()) {
      res.status(503).json({ error: 'WEB auth disabled', code: 'web_disabled' })
      return
    }
    const email = typeof req.body?.email === 'string' ? req.body.email : ''
    const code = typeof req.body?.code === 'string' ? req.body.code : ''
    const recovered = await completeEmailRecover({
      email,
      code,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
    })
    const maxAgeSec = Math.floor(sessionTtlMs() / 1000)
    setSessionCookies(res, {
      sessionToken: recovered.sessionToken,
      csrfToken: recovered.csrfToken,
      maxAgeSec,
    })
    res.status(200).json({
      ok: true,
      webAccountId: recovered.webAccountId,
      expiresAt: recovered.expiresAt.toISOString(),
    })
  } catch (e) {
    const { status, body } = errorPayload(e)
    res.status(status).json(body)
  }
})

/**
 * Dual-auth probe (initData OR WEB session).
 * GET /api/web/auth/whoami
 */
router.get('/web/auth/whoami', async (req: Request, res: Response) => {
  try {
    const auth = await resolveAuth(req)
    if (!auth) {
      res.status(401).json({ error: 'Unauthorized', code: 'unauthorized' })
      return
    }
    res.status(200).json({
      ok: true,
      telegramId: auth.telegramId ?? null,
      webAccountId: auth.webAccountId ?? null,
      source: auth.source,
      sessionId: auth.sessionId ?? null,
    })
  } catch (e) {
    const { status, body } = errorPayload(e)
    res.status(status).json(body)
  }
})

export default router
