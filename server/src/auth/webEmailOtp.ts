import type { Queryable } from '../legal/types.js'
import { query as defaultQuery } from '../db.js'
import { randomToken, sha256Hex } from './cryptoTokens.js'
import { sessionTtlMs, webPublicOrigin } from './config.js'
import { getMailTransport } from '../services/mailTransport.js'
import { grantWebEntitlement } from './webAccounts.js'
import { consumeSharedRateLimit } from './rateLimit.js'

type Db = {
  query: <T>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>
}

function db(custom?: Queryable): Db {
  if (custom) {
    return {
      query: async <T>(sql: string, params?: unknown[]) => {
        const result = await custom.query<T>(sql, params)
        return { rows: result.rows as T[] }
      },
    }
  }
  return {
    query: async <T>(sql: string, params?: unknown[]) => {
      const result = await defaultQuery(sql, params)
      return { rows: result.rows as T[] }
    },
  }
}

export function normalizeEmail(raw: string): string | null {
  const v = raw.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || v.length > 320) return null
  return v
}

const LINK_TTL_MS = 30 * 60_000
const MAX_ATTEMPTS = 5
const TOKEN_RE = /^[A-Za-z0-9_-]{20,128}$/

function magicConfirmPath(token: string): string {
  const origin = webPublicOrigin() || 'http://localhost:5173'
  return `${origin}/email/confirm?token=${encodeURIComponent(token)}`
}

function mailShell(title: string, bodyHtml: string, textBody: string): {
  subject: string
  text: string
  html: string
} {
  const subject = `GameNight Host — ${title}`
  const text = ['GameNight Host', '', textBody, '', 'Если вы не запрашивали это письмо — просто проигнорируйте его.'].join(
    '\n'
  )
  const html = `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#ece7df;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;color:#1c1917;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ece7df;padding:36px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;background:#faf8f4;border:1px solid #d6d0c6;border-radius:12px;padding:28px 26px;">
        <tr><td>
          <p style="margin:0 0 10px;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#6b645c;">GameNight Host</p>
          <h1 style="margin:0 0 12px;font-size:24px;font-weight:600;line-height:1.25;color:#1c1917;">${title}</h1>
          ${bodyHtml}
          <p style="margin:18px 0 0;font-size:12px;color:#78716c;">Если вы не запрашивали это письмо — просто проигнорируйте его.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
  return { subject, text, html }
}

/** Informational only — does not verify ownership and has no login CTA. */
function buildWelcomeInfoMail(): { subject: string; text: string; html: string } {
  const subject = 'Добро пожаловать в GameNight Host!'
  const text = [
    'Ваш email добавлен в GameNight Host. Можно продолжать играть и пользоваться приложением.',
    '',
    'Если вы не указывали этот адрес, просто проигнорируйте сообщение.',
  ].join('\n')
  const html = `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#ece7df;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;color:#1c1917;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ece7df;padding:36px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;background:#faf8f4;border:1px solid #d6d0c6;border-radius:12px;padding:28px 26px;">
        <tr><td>
          <p style="margin:0 0 10px;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#6b645c;">GameNight Host</p>
          <h1 style="margin:0 0 12px;font-size:24px;font-weight:600;line-height:1.25;color:#1c1917;">Добро пожаловать!</h1>
          <p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:#44403c;">Ваш email добавлен в GameNight Host. Можно продолжать играть и пользоваться приложением.</p>
          <p style="margin:0;font-size:15px;line-height:1.55;color:#44403c;">Если вы не указывали этот адрес, просто проигнорируйте сообщение.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
  return { subject, text, html }
}

function buildMagicMail(input: {
  purpose: 'bind' | 'recover'
  link: string
}): { subject: string; text: string; html: string } {
  const isRecover = input.purpose === 'recover'
  const title = isRecover ? 'Ссылка для входа' : 'Ссылка для подтверждения почты'
  const lead = isRecover
    ? 'Вы запросили вход в GameNight Host. Откройте ссылку на устройстве, где хотите продолжить.'
    : 'Вы запросили подтверждение почты. Откройте ссылку, чтобы завершить вход.'
  const cta = isRecover ? 'Войти' : 'Подтвердить и войти'
  return mailShell(
    title,
    `<p style="margin:0 0 22px;font-size:16px;line-height:1.55;color:#44403c;">${lead}</p>
     <p style="margin:0 0 22px;">
       <a href="${input.link}" style="display:inline-block;padding:13px 24px;background:#1c1917;color:#faf8f4;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">${cta}</a>
     </p>
     <p style="margin:0 0 10px;font-size:13px;line-height:1.45;color:#57534e;">Ссылка одноразовая и действует <strong>30 минут</strong>. Сам факт получения письма ничего не активирует.</p>
     <p style="margin:0;font-size:12px;word-break:break-all;color:#78716c;">${input.link}</p>`,
    [lead, '', 'Ссылка действует 30 минут и одноразовая:', input.link].join('\n')
  )
}

export async function countRecentEmailOtps(
  emailNormalized: string,
  sinceMs: number,
  customDb?: Queryable
): Promise<number> {
  const since = new Date(Date.now() - sinceMs).toISOString()
  const result = await db(customDb).query<{ c: string }>(
    `SELECT count(*)::text AS c FROM web_email_otps
      WHERE email_normalized = $1 AND created_at >= $2::timestamptz`,
    [emailNormalized, since]
  )
  return Number(result.rows[0]?.c || 0)
}

async function insertAndSendMagicLink(input: {
  webAccountId: string
  emailNormalized: string
  purpose: 'bind' | 'recover'
  ip?: string | null
  db?: Queryable
}): Promise<{ expiresAt: Date; echoToken?: string }> {
  const ipKey = (input.ip || 'unknown').slice(0, 64)
  for (const key of [
    `email_otp_ip:${ipKey}`,
    `email_otp_email:${input.emailNormalized}`,
    `email_otp_account:${input.webAccountId}`,
  ]) {
    const limited = await consumeSharedRateLimit(
      key,
      key.startsWith('email_otp_ip:') ? 10 : 3,
      60_000,
      input.db
    )
    if (!limited.ok) {
      const err = new Error('Too many codes') as Error & { status?: number; code?: string }
      err.status = 429
      err.code = 'rate_limited'
      throw err
    }
  }

  const recent = await countRecentEmailOtps(input.emailNormalized, 60_000, input.db)
  if (recent >= 3) {
    const err = new Error('Too many codes') as Error & { status?: number; code?: string }
    err.status = 429
    err.code = 'rate_limited'
    throw err
  }

  const token = randomToken(32)
  const expiresAt = new Date(Date.now() + LINK_TTL_MS)
  await db(input.db).query(
    `INSERT INTO web_email_otps (web_account_id, email_normalized, code_hash, purpose, expires_at)
     VALUES ($1::uuid, $2, $3, $4, $5)`,
    [input.webAccountId, input.emailNormalized, sha256Hex(token), input.purpose, expiresAt.toISOString()]
  )

  const link = magicConfirmPath(token)
  const mail = buildMagicMail({ purpose: input.purpose, link })
  try {
    await getMailTransport().send({
      to: input.emailNormalized,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    })
  } catch (e) {
    const err = e as Error & { status?: number; code?: string }
    // Never treat a send failure as a successful bind / recover start.
    if (!err.status) err.status = 502
    if (!err.code) err.code = 'mail_send_failed'
    throw err
  }

  const echo =
    process.env.WEB_EMAIL_OTP_ECHO === '1' && process.env.NODE_ENV !== 'production'
      ? token
      : undefined

  return { expiresAt, echoToken: echo }
}

/** Persist checkout receipt email on the payment row (not verified ownership). */
export async function savePaymentReceiptEmail(input: {
  paymentId: string
  email: string
  db?: Queryable
}): Promise<string | null> {
  const emailNormalized = normalizeEmail(input.email)
  if (!emailNormalized) return null
  await db(input.db).query(
    `UPDATE web_payments
        SET receipt_email_normalized = $2
      WHERE id = $1`,
    [input.paymentId, emailNormalized]
  )
  return emailNormalized
}

/**
 * After successful Premium grant: optionally remember receipt email as pending
 * recovery address (not verified). Never sends SMTP mail — YooKassa receipt is enough.
 * Never auto-merges accounts. Recover magic link is sent only on explicit user request.
 */
export async function afterWebPurchasePaid(input: {
  webAccountId: string
  paymentId: string
  ip?: string | null
  db?: Queryable
  /** Explicit checkout opt-in to use receipt email for later Premium recovery. */
  bindAccountEmail?: boolean
}): Promise<{ pendingEmail: string | null; linkSent: boolean }> {
  const pay = await db(input.db).query<{ receipt_email_normalized: string | null }>(
    `SELECT receipt_email_normalized FROM web_payments WHERE id = $1 LIMIT 1`,
    [input.paymentId]
  )
  const receipt = pay.rows[0]?.receipt_email_normalized
    ? normalizeEmail(pay.rows[0].receipt_email_normalized)
    : null
  if (!receipt) return { pendingEmail: null, linkSent: false }

  // Without opt-in, receipt stays on the payment only — not usable as account bind.
  if (!input.bindAccountEmail) {
    return { pendingEmail: null, linkSent: false }
  }

  const account = await db(input.db).query<{
    email_normalized: string | null
    email_verified_at: Date | null
    pending_email_normalized: string | null
  }>(
    `SELECT email_normalized, email_verified_at, pending_email_normalized
       FROM web_accounts
      WHERE id = $1::uuid AND revoked_at IS NULL
      LIMIT 1`,
    [input.webAccountId]
  )
  const row = account.rows[0]
  if (!row) return { pendingEmail: null, linkSent: false }

  const alreadyVerifiedSame =
    Boolean(row.email_verified_at) && row.email_normalized === receipt
  if (alreadyVerifiedSame) {
    return { pendingEmail: null, linkSent: false }
  }

  // Never auto-bind a receipt email over a different already-verified login email.
  if (row.email_verified_at && row.email_normalized && row.email_normalized !== receipt) {
    return { pendingEmail: null, linkSent: false }
  }

  const taken = await db(input.db).query<{ id: string }>(
    `SELECT id FROM web_accounts
      WHERE email_normalized = $1
        AND email_verified_at IS NOT NULL
        AND revoked_at IS NULL
        AND id <> $2::uuid
      LIMIT 1`,
    [receipt, input.webAccountId]
  )
  if (taken.rows[0]) {
    return { pendingEmail: null, linkSent: false }
  }

  await db(input.db).query(
    `UPDATE web_accounts
        SET pending_email_normalized = $2,
            last_seen_at = now()
      WHERE id = $1::uuid AND revoked_at IS NULL`,
    [input.webAccountId, receipt]
  )

  // No post-purchase SMTP — contact email is saved without verification or magic link.
  return { pendingEmail: receipt, linkSent: false }
}

export type EmailBindResult = {
  /** created = new contact on current account; restored = switched to existing account; updated = same email again */
  mode: 'created' | 'restored' | 'updated'
  webAccountId: string
  infoMailSent: boolean
  expiresAt: Date
  echoToken?: string
  sessionToken?: string
  csrfToken?: string
  sessionExpiresAt?: Date
}

async function issueSessionForWebAccount(input: {
  webAccountId: string
  userAgent?: string | null
  db?: Queryable
}): Promise<{ sessionToken: string; csrfToken: string; expiresAt: Date }> {
  const sessionToken = randomToken(32)
  const csrfToken = randomToken(32)
  const expiresAt = new Date(Date.now() + sessionTtlMs())
  const uaHash = input.userAgent ? sha256Hex(input.userAgent.slice(0, 512)) : null
  await db(input.db).query(
    `INSERT INTO web_sessions (token_hash, csrf_hash, web_account_id, expires_at, user_agent_hash)
     VALUES ($1, $2, $3::uuid, $4, $5)`,
    [
      sha256Hex(sessionToken),
      sha256Hex(csrfToken),
      input.webAccountId,
      expiresAt.toISOString(),
      uaHash,
    ]
  )
  return { sessionToken, csrfToken, expiresAt }
}

/**
 * Save contact email on the current WEB account, or restore an existing account
 * that already has this email (pending or verified) — including its Premium.
 * No magic link / ownership proof beyond knowing the address (product choice).
 */
export async function startEmailBind(input: {
  webAccountId: string
  email: string
  ip?: string | null
  userAgent?: string | null
  db?: Queryable
  /** When false, skip welcome mail (e.g. checkout opt-in already paid). Default true. */
  sendWelcomeMail?: boolean
}): Promise<EmailBindResult> {
  const emailNormalized = normalizeEmail(input.email)
  if (!emailNormalized) {
    const err = new Error('Invalid email') as Error & { status?: number; code?: string }
    err.status = 400
    err.code = 'invalid_email'
    throw err
  }

  // Existing account with this email → restore that session (Premium stays on that webAccountId).
  const existing = await db(input.db).query<{ id: string }>(
    `SELECT id FROM web_accounts
      WHERE revoked_at IS NULL
        AND id <> $2::uuid
        AND (
          (email_normalized = $1 AND email_verified_at IS NOT NULL)
          OR pending_email_normalized = $1
        )
      ORDER BY
        CASE WHEN email_verified_at IS NOT NULL THEN 0 ELSE 1 END,
        created_at ASC
      LIMIT 1`,
    [emailNormalized, input.webAccountId]
  )
  if (existing.rows[0]) {
    const ipKey = (input.ip || 'unknown').slice(0, 64)
    const limited = await consumeSharedRateLimit(
      `email_restore_ip:${ipKey}`,
      20,
      60 * 60_000,
      input.db
    )
    if (!limited.ok) {
      const err = new Error('Too many attempts') as Error & { status?: number; code?: string }
      err.status = 429
      err.code = 'rate_limited'
      throw err
    }
    const targetId = String(existing.rows[0].id)
    const session = await issueSessionForWebAccount({
      webAccountId: targetId,
      userAgent: input.userAgent,
      db: input.db,
    })
    await db(input.db).query(
      `UPDATE web_accounts SET last_seen_at = now() WHERE id = $1::uuid`,
      [targetId]
    )
    return {
      mode: 'restored',
      webAccountId: targetId,
      infoMailSent: false,
      expiresAt: session.expiresAt,
      sessionToken: session.sessionToken,
      csrfToken: session.csrfToken,
      sessionExpiresAt: session.expiresAt,
    }
  }

  const before = await db(input.db).query<{
    pending_email_normalized: string | null
    email_normalized: string | null
    email_verified_at: Date | null
  }>(
    `SELECT pending_email_normalized, email_normalized, email_verified_at
       FROM web_accounts
      WHERE id = $1::uuid AND revoked_at IS NULL
      LIMIT 1`,
    [input.webAccountId]
  )
  const prev = before.rows[0]
  // Never replace a different already-verified login email with another contact.
  if (
    prev?.email_verified_at &&
    prev.email_normalized &&
    prev.email_normalized !== emailNormalized
  ) {
    const err = new Error('Verified email already set') as Error & { status?: number; code?: string }
    err.status = 409
    err.code = 'email_already_verified'
    throw err
  }

  const alreadySame =
    (Boolean(prev?.email_verified_at) && prev?.email_normalized === emailNormalized) ||
    prev?.pending_email_normalized === emailNormalized

  await db(input.db).query(
    `UPDATE web_accounts
        SET pending_email_normalized = $2,
            last_seen_at = now()
      WHERE id = $1::uuid AND revoked_at IS NULL
        AND (email_verified_at IS NULL OR email_normalized IS NOT DISTINCT FROM $2)`,
    [input.webAccountId, emailNormalized]
  )

  let infoMailSent = false
  const wantMail = input.sendWelcomeMail !== false
  if (wantMail && !alreadySame) {
    const ipKey = (input.ip || 'unknown').slice(0, 64)
    for (const key of [
      `email_welcome_ip:${ipKey}`,
      `email_welcome_addr:${emailNormalized}`,
      `email_welcome_acct:${input.webAccountId}`,
    ]) {
      const limited = await consumeSharedRateLimit(
        key,
        key.startsWith('email_welcome_ip:') ? 8 : 2,
        60 * 60_000,
        input.db
      )
      if (!limited.ok) {
        return {
          mode: 'created',
          webAccountId: input.webAccountId,
          expiresAt: new Date(Date.now() + LINK_TTL_MS),
          infoMailSent: false,
        }
      }
    }
    try {
      const mail = buildWelcomeInfoMail()
      await getMailTransport().send({
        to: emailNormalized,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      })
      infoMailSent = true
    } catch (e) {
      const err = e as Error
      console.error('[webEmail] startEmailBind welcome mail failed', err.message)
    }
  }

  return {
    mode: alreadySame ? 'updated' : 'created',
    webAccountId: input.webAccountId,
    expiresAt: new Date(Date.now() + LINK_TTL_MS),
    infoMailSent,
  }
}

/**
 * Start recover / login magic link. Always returns generic ok (anti-enumeration).
 * Sends only for verified email OR pending email saved via opt-in bind / checkout checkbox.
 * A paid receipt alone (without pending opt-in) is not enough to bind an account.
 */
export async function startEmailRecover(input: {
  email: string
  ip?: string | null
  db?: Queryable
}): Promise<{ ok: true; expiresAt?: string; echoToken?: string }> {
  const emailNormalized = normalizeEmail(input.email)
  if (!emailNormalized) {
    return { ok: true }
  }
  const ipLimited = await consumeSharedRateLimit(
    `email_recover_ip:${(input.ip || 'unknown').slice(0, 64)}`,
    8,
    60_000,
    input.db
  )
  if (!ipLimited.ok) {
    return { ok: true }
  }

  let account = await db(input.db).query<{ id: string }>(
    `SELECT id FROM web_accounts
      WHERE email_normalized = $1
        AND email_verified_at IS NOT NULL
        AND revoked_at IS NULL
      LIMIT 1`,
    [emailNormalized]
  )

  if (!account.rows[0]) {
    account = await db(input.db).query<{ id: string }>(
      `SELECT a.id
         FROM web_accounts a
        WHERE a.revoked_at IS NULL
          AND a.pending_email_normalized = $1
          AND NOT EXISTS (
            SELECT 1 FROM web_accounts o
             WHERE o.email_normalized = $1
               AND o.email_verified_at IS NOT NULL
               AND o.revoked_at IS NULL
               AND o.id <> a.id
          )
        ORDER BY a.created_at ASC
        LIMIT 1`,
      [emailNormalized]
    )
  }

  if (!account.rows[0]) {
    return { ok: true }
  }

  try {
    const started = await insertAndSendMagicLink({
      webAccountId: account.rows[0].id,
      emailNormalized,
      purpose: 'recover',
      ip: input.ip,
      db: input.db,
    })
    return {
      ok: true,
      expiresAt: started.expiresAt.toISOString(),
      echoToken: started.echoToken,
    }
  } catch (e) {
    const err = e as Error & { code?: string }
    if (err.code === 'rate_limited') return { ok: true }
    throw e
  }
}

/**
 * Complete magic-link (bind or recover). Consumes token only on intentional POST
 * so mail-client prefetch does not burn the link.
 */
export async function completeEmailMagicLink(input: {
  token: string
  userAgent?: string | null
  db?: Queryable
}): Promise<{
  webAccountId: string
  emailNormalized: string
  purpose: 'bind' | 'recover'
  sessionToken: string
  csrfToken: string
  expiresAt: Date
}> {
  const token = input.token.trim()
  if (!TOKEN_RE.test(token)) {
    const err = new Error('Invalid link') as Error & { status?: number; code?: string }
    err.status = 400
    err.code = 'invalid_token'
    throw err
  }

  const result = await db(input.db).query<{
    id: number
    web_account_id: string
    email_normalized: string
    purpose: 'bind' | 'recover'
    attempts: number
    expires_at: Date
    consumed_at: Date | null
  }>(
    `SELECT id, web_account_id::text AS web_account_id, email_normalized, purpose,
            attempts, expires_at, consumed_at
       FROM web_email_otps
      WHERE code_hash = $1
      ORDER BY id DESC
      LIMIT 1`,
    [sha256Hex(token)]
  )
  const row = result.rows[0]
  if (!row || row.consumed_at || new Date(row.expires_at).getTime() <= Date.now()) {
    const err = new Error('Link expired or unknown') as Error & { status?: number; code?: string }
    err.status = 400
    err.code = 'token_invalid'
    throw err
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    const err = new Error('Too many attempts') as Error & { status?: number; code?: string }
    err.status = 429
    err.code = 'rate_limited'
    throw err
  }

  await db(input.db).query(`UPDATE web_email_otps SET attempts = attempts + 1 WHERE id = $1`, [row.id])

  const taken = await db(input.db).query<{ id: string }>(
    `SELECT id FROM web_accounts
      WHERE email_normalized = $1
        AND email_verified_at IS NOT NULL
        AND revoked_at IS NULL
        AND id <> $2::uuid
      LIMIT 1`,
    [row.email_normalized, row.web_account_id]
  )
  if (taken.rows[0]) {
    const err = new Error('Email already linked') as Error & { status?: number; code?: string }
    err.status = 409
    err.code = 'email_taken'
    throw err
  }

  // Defense: do not replace a verified login email unless the account explicitly
  // started a rebind (pending_email_normalized matches this token).
  if (row.purpose === 'bind') {
    const current = await db(input.db).query<{
      email_normalized: string | null
      email_verified_at: Date | null
      pending_email_normalized: string | null
    }>(
      `SELECT email_normalized, email_verified_at, pending_email_normalized
         FROM web_accounts
        WHERE id = $1::uuid AND revoked_at IS NULL
        LIMIT 1`,
      [row.web_account_id]
    )
    const cur = current.rows[0]
    if (
      cur?.email_verified_at &&
      cur.email_normalized &&
      cur.email_normalized !== row.email_normalized &&
      cur.pending_email_normalized !== row.email_normalized
    ) {
      const err = new Error('Verified email already set') as Error & { status?: number; code?: string }
      err.status = 409
      err.code = 'email_already_verified'
      throw err
    }
  }

  const claimed = await db(input.db).query<{ id: number }>(
    `UPDATE web_email_otps
        SET consumed_at = now()
      WHERE id = $1 AND consumed_at IS NULL
      RETURNING id`,
    [row.id]
  )
  if (!claimed.rows[0]) {
    const err = new Error('Link already used') as Error & { status?: number; code?: string }
    err.status = 400
    err.code = 'token_invalid'
    throw err
  }

  await db(input.db).query(
    `UPDATE web_accounts
        SET email_normalized = $2,
            email_verified_at = now(),
            pending_email_normalized = NULL,
            last_seen_at = now()
      WHERE id = $1::uuid AND revoked_at IS NULL`,
    [row.web_account_id, row.email_normalized]
  )

  const sessionToken = randomToken(32)
  const csrfToken = randomToken(32)
  const expiresAt = new Date(Date.now() + sessionTtlMs())
  const uaHash = input.userAgent ? sha256Hex(input.userAgent.slice(0, 512)) : null

  await db(input.db).query(
    `INSERT INTO web_sessions (token_hash, csrf_hash, web_account_id, expires_at, user_agent_hash)
     VALUES ($1, $2, $3::uuid, $4, $5)`,
    [sha256Hex(sessionToken), sha256Hex(csrfToken), row.web_account_id, expiresAt.toISOString(), uaHash]
  )

  return {
    webAccountId: row.web_account_id,
    emailNormalized: row.email_normalized,
    purpose: row.purpose,
    sessionToken,
    csrfToken,
    expiresAt,
  }
}

/** Staging helper: grant manual premium for E2E without payment. */
export async function grantManualStagingPremium(
  webAccountId: string,
  planId: string,
  activeUntil: Date,
  customDb?: Queryable
): Promise<void> {
  await grantWebEntitlement({
    webAccountId,
    planId,
    activeUntil,
    source: 'manual_staging',
    db: customDb,
  })
}
