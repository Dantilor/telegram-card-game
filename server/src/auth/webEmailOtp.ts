import { randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto'
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

function buildMagicMail(input: {
  purpose: 'bind' | 'recover'
  link: string
}): { subject: string; text: string; html: string } {
  const isRecover = input.purpose === 'recover'
  const title = isRecover ? 'Ссылка для входа' : 'Ссылка для подтверждения почты'
  const lead = isRecover
    ? 'Вы запросили вход в GameNight Host. Откройте ссылку на устройстве, где хотите продолжить — оплаченный Premium откроется автоматически.'
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
 * After a successful WEB payment, automatically save the receipt email as an
 * unverified contact on the paying account. The payer is already signed in
 * through the current WEB session and their Premium works immediately.
 * The receipt address is NOT proof of identity or a passwordless login.
 * Recovery on another device still requires a magic link.
 */
export async function afterWebPurchasePaid(input: {
  webAccountId: string
  paymentId: string
  ip?: string | null
  db?: Queryable
  /** Legacy metadata for older checkout requests; no longer gates saving receipt email. */
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

/** The account whose login email is this verified address — the only account a mailbox can sign into. */
async function findVerifiedAccount(emailNormalized: string, customDb?: Queryable): Promise<string | null> {
  const verified = await db(customDb).query<{ id: string }>(
    `SELECT id::text AS id FROM web_accounts
      WHERE email_normalized = $1
        AND email_verified_at IS NOT NULL
        AND revoked_at IS NULL
      LIMIT 1`,
    [emailNormalized]
  )
  return verified.rows[0] ? String(verified.rows[0].id) : null
}

async function unverifiedGuestAccount(accountId: string | null | undefined, customDb?: Queryable): Promise<string | null> {
  if (!accountId) return null
  const r = await db(customDb).query<{ id: string }>(
    `SELECT id::text AS id FROM web_accounts
      WHERE id = $1::uuid AND revoked_at IS NULL AND email_verified_at IS NULL
      LIMIT 1`,
    [accountId]
  )
  return r.rows[0] ? String(r.rows[0].id) : null
}

/**
 * Save the email typed in Profile as an unverified contact for THIS session only.
 * Never switches WEB accounts, never grants Premium from another account, and
 * never emails the user. Recovery on another device stays magic-link protected.
 */
export async function saveProfileContactEmail(input: {
  webAccountId: string
  email: string
  db?: Queryable
}): Promise<{ mode: 'saved' | 'verified' }> {
  const emailNormalized = normalizeEmail(input.email)
  if (!emailNormalized) {
    const err = new Error('Invalid email') as Error & { status?: number; code?: string }
    err.status = 400
    err.code = 'invalid_email'
    throw err
  }
  const q = db(input.db)
  const account = await q.query<{
    email_normalized: string | null
    email_verified_at: Date | null
  }>(
    `SELECT email_normalized, email_verified_at
       FROM web_accounts WHERE id = $1::uuid AND revoked_at IS NULL LIMIT 1`,
    [input.webAccountId]
  )
  const current = account.rows[0]
  if (!current) {
    const err = new Error('WEB account required') as Error & { status?: number; code?: string }
    err.status = 401
    err.code = 'web_account_required'
    throw err
  }
  if (current.email_verified_at) {
    if (current.email_normalized === emailNormalized) return { mode: 'verified' }
    const err = new Error('Verified email already set') as Error & { status?: number; code?: string }
    err.status = 409
    err.code = 'email_already_verified'
    throw err
  }
  await q.query(
    `UPDATE web_accounts
        SET pending_email_normalized = $2, last_seen_at = now()
      WHERE id = $1::uuid AND revoked_at IS NULL`,
    [input.webAccountId, emailNormalized]
  )
  return { mode: 'saved' }
}

export type EmailBindResult = {
  /** verify_sent = a one-time link was mailed; verified = this account already owns the address. */
  mode: 'verify_sent' | 'verified'
  expiresAt?: Date
  echoToken?: string
}

/**
 * Profile "save email". Never switches sessions by address alone: a one-time link
 * goes to the mailbox — sign-in to the account that already verified the address,
 * otherwise confirmation that makes the current account its owner. Purchases whose
 * receipt went to the address then show up in that one account. The answer is the
 * same either way, so it does not reveal whether the address is registered.
 */
export async function startEmailBind(input: {
  webAccountId: string
  email: string
  ip?: string | null
  db?: Queryable
}): Promise<EmailBindResult> {
  const emailNormalized = normalizeEmail(input.email)
  if (!emailNormalized) {
    const err = new Error('Invalid email') as Error & { status?: number; code?: string }
    err.status = 400
    err.code = 'invalid_email'
    throw err
  }

  const current = await db(input.db).query<{
    email_normalized: string | null
    email_verified_at: Date | null
  }>(
    `SELECT email_normalized, email_verified_at
       FROM web_accounts
      WHERE id = $1::uuid AND revoked_at IS NULL
      LIMIT 1`,
    [input.webAccountId]
  )
  const cur = current.rows[0]
  if (!cur) {
    const err = new Error('WEB account required') as Error & { status?: number; code?: string }
    err.status = 401
    err.code = 'web_account_required'
    throw err
  }
  if (cur.email_verified_at && cur.email_normalized === emailNormalized) {
    return { mode: 'verified' }
  }
  // Never replace a different already-verified login email with another contact.
  if (cur.email_verified_at && cur.email_normalized) {
    const err = new Error('Verified email already set') as Error & { status?: number; code?: string }
    err.status = 409
    err.code = 'email_already_verified'
    throw err
  }

  const verifiedOwner = await findVerifiedAccount(emailNormalized, input.db)
  const owner = verifiedOwner === input.webAccountId ? null : verifiedOwner
  const started = await insertAndSendMagicLink({
    webAccountId: owner ?? input.webAccountId,
    emailNormalized,
    purpose: owner ? 'recover' : 'bind',
    ip: input.ip,
    db: input.db,
  })
  return { mode: 'verify_sent', expiresAt: started.expiresAt, echoToken: started.echoToken }
}
/** Empty account an earlier login-page request created for this address (never had a session). */
async function loginOnlyAccountFor(emailNormalized: string, customDb?: Queryable): Promise<string | null> {
  const r = await db(customDb).query<{ id: string }>(
    `SELECT a.id::text AS id
       FROM web_email_otps o
       JOIN web_accounts a ON a.id = o.web_account_id
      WHERE o.email_normalized = $1
        AND o.purpose = 'bind'
        AND a.revoked_at IS NULL
        AND a.email_verified_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM web_sessions s WHERE s.web_account_id = a.id)
        AND NOT EXISTS (SELECT 1 FROM web_payments p WHERE p.web_account_id = a.id)
      ORDER BY o.created_at DESC
      LIMIT 1`,
    [emailNormalized]
  )
  return r.rows[0] ? String(r.rows[0].id) : null
}

/**
 * Login-page magic link. Always returns generic ok (anti-enumeration).
 * Signs into the account that verified this address. Otherwise the link confirms the
 * address for the caller's own guest account (session + CSRF verified by the route)
 * or for a new empty account. A YooKassa receipt or an unconfirmed contact address
 * never opens the guest account that paid: those purchases appear in the confirmed
 * account instead (EMAIL_CLAIMED_WEB_ENTITLEMENTS_SQL).
 */
export async function startEmailRecover(input: {
  email: string
  ip?: string | null
  /** Caller's WEB account; only pass it after the session and CSRF token were verified. */
  callerAccountId?: string | null
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

  const owner = await findVerifiedAccount(emailNormalized, input.db)
  let target = owner
  if (!target) {
    if ((await countRecentEmailOtps(emailNormalized, 60_000, input.db)) >= 3) return { ok: true }
    target =
      (await unverifiedGuestAccount(input.callerAccountId, input.db)) ??
      (await loginOnlyAccountFor(emailNormalized, input.db))
    if (!target) {
      const created = await db(input.db).query<{ id: string }>(
        `INSERT INTO web_accounts DEFAULT VALUES RETURNING id::text AS id`
      )
      target = String(created.rows[0]!.id)
    }
  }
  try {
    const started = await insertAndSendMagicLink({
      webAccountId: target,
      emailNormalized,
      purpose: owner ? 'recover' : 'bind',
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

  return finishVerifiedEmailChallenge(row, input.userAgent, input.db)

}


/** Shared account binding and session rotation after valid link OR code. */
async function finishVerifiedEmailChallenge(
  row: { id: number; web_account_id: string; email_normalized: string; purpose: 'bind' | 'recover' },
  userAgent: string | null | undefined,
  customDb?: Queryable
): Promise<{
  webAccountId: string; emailNormalized: string; purpose: 'bind' | 'recover'
  sessionToken: string; csrfToken: string; expiresAt: Date
}> {
  // The link proves the mailbox; when that address already has its own verified
  // account (verified after the link was sent), sign into it — one email, one account.
  const verifiedOwner = await findVerifiedAccount(row.email_normalized, customDb)
  const existingOwner =
    verifiedOwner && verifiedOwner !== row.web_account_id ? verifiedOwner : null

  // Defense: do not replace a verified login email unless the account explicitly
  // started a rebind (pending_email_normalized matches this token).
  if (!existingOwner) {
    const current = await db(customDb).query<{
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
    // Sign-in links open only an account whose login email is this very address.
    if (
      row.purpose === 'recover' &&
      !(cur?.email_verified_at && cur.email_normalized === row.email_normalized)
    ) {
      const err = new Error('Link no longer valid') as Error & { status?: number; code?: string }
      err.status = 400
      err.code = 'token_invalid'
      throw err
    }
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

  const claimed = await db(customDb).query<{ id: number }>(
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

  let accountId = existingOwner ?? row.web_account_id
  if (!existingOwner) {
    try {
      await db(customDb).query(
        `UPDATE web_accounts
            SET email_normalized = $2,
                email_verified_at = now(),
                pending_email_normalized = NULL,
                last_seen_at = now()
          WHERE id = $1::uuid AND revoked_at IS NULL`,
        [row.web_account_id, row.email_normalized]
      )
    } catch (e) {
      // A concurrent confirmation of the same address won the unique index.
      if ((e as { code?: string }).code !== '23505') throw e
      const winner = await findVerifiedAccount(row.email_normalized, customDb)
      if (!winner) throw e
      accountId = winner
    }
  }

  const sessionToken = randomToken(32)
  const csrfToken = randomToken(32)
  const expiresAt = new Date(Date.now() + sessionTtlMs())
  const uaHash = userAgent ? sha256Hex(userAgent.slice(0, 512)) : null

  await db(customDb).query(
    `INSERT INTO web_sessions (token_hash, csrf_hash, web_account_id, expires_at, user_agent_hash)
     VALUES ($1, $2, $3::uuid, $4, $5)`,
    [sha256Hex(sessionToken), sha256Hex(csrfToken), accountId, expiresAt.toISOString(), uaHash]
  )

  return {
    webAccountId: accountId,
    emailNormalized: row.email_normalized,
    purpose: row.purpose,
    sessionToken,
    csrfToken,
    expiresAt,
  }
}

/** Six-digit email code: enter in the same browser/PWA, no links or navigation. */
const EMAIL_CODE_TTL_MS = 10 * 60_000
const EMAIL_CODE_REGEX = /^[0-9]{6}$/

/** Store a salted scrypt hash in the existing CHAR(64) challenge column. */
function emailCodeHash(code: string): string {
  const salt = randomBytes(8)
  return salt.toString('hex') + scryptSync(code, salt, 24).toString('hex')
}
function emailCodeMatches(code: string, stored: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(stored)) return false
  const salt = Buffer.from(stored.slice(0, 16), 'hex')
  const actual = Buffer.from(stored.slice(16), 'hex')
  return timingSafeEqual(actual, scryptSync(code, salt, 24))
}

export async function startEmailCode(input: {
  webAccountId: string; email: string; ip?: string | null; db?: Queryable
}): Promise<{ mode: 'code_sent'; challengeId: string; expiresAt: Date; echoCode?: string }> {
  const email = normalizeEmail(input.email)
  if (!email) {
    const err = new Error('Invalid email') as Error & { status?: number; code?: string }
    err.status = 400; err.code = 'invalid_email'; throw err
  }
  const current = await db(input.db).query<{ email_normalized: string | null; email_verified_at: Date | null }>(
    `SELECT email_normalized, email_verified_at FROM web_accounts
     WHERE id = $1::uuid AND revoked_at IS NULL LIMIT 1`, [input.webAccountId]
  )
  if (!current.rows[0]) {
    const err = new Error('Account missing') as Error & { status?: number; code?: string }
    err.status = 401; err.code = 'web_account_required'; throw err
  }
  if (current.rows[0].email_verified_at && current.rows[0].email_normalized !== email &&
      !(await findVerifiedAccount(email, input.db))) {
    const err = new Error('Sign out before changing a verified email') as Error & { status?: number; code?: string }
    err.status = 409; err.code = 'email_already_verified'; throw err
  }
  const ip = (input.ip || 'unknown').slice(0, 64)
  for (const key of [`email_otp_ip:${ip}`, `email_otp_email:${email}`, `email_otp_account:${input.webAccountId}`]) {
    const limit = await consumeSharedRateLimit(key, key.startsWith('email_otp_ip:') ? 10 : 3, 60_000, input.db)
    if (!limit.ok) {
      const err = new Error('Too many codes') as Error & { status?: number; code?: string }
      err.status = 429; err.code = 'rate_limited'; throw err
    }
  }
  if (await countRecentEmailOtps(email, 60_000, input.db) >= 3) {
    const err = new Error('Too many codes') as Error & { status?: number; code?: string }
    err.status = 429; err.code = 'rate_limited'; throw err
  }
  const code = randomInt(0, 1_000_000).toString().padStart(6, '0')
  const expiresAt = new Date(Date.now() + EMAIL_CODE_TTL_MS)
  const rows = await db(input.db).query<{ id: string }>(
    `INSERT INTO web_email_otps (web_account_id, email_normalized, code_hash, purpose, expires_at)
     VALUES ($1::uuid, $2, $3, 'bind', $4) RETURNING id::text AS id`,
    [input.webAccountId, email, emailCodeHash(code), expiresAt.toISOString()]
  )
  const challengeId = rows.rows[0]!.id
  const mail = mailShell(
    'Ваш код подтверждения',
    `<p>Введите этот код в открытом браузере GameNight Host:</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:0.15em;">${code}</p>
      <p>Код действует 10 минут. Никому его не сообщайте.</p>`,
    `Ваш код: ${code}\nВведите его в профиле или на странице входа. Срок действия: 10 минут.`
  )
  try {
    await getMailTransport().send({ to: email, subject: mail.subject, text: mail.text, html: mail.html })
  } catch (e) {
    await db(input.db).query('UPDATE web_email_otps SET consumed_at = now() WHERE id = $1', [challengeId])
    const err = e as Error & { status?: number; code?: string }
    if (!err.status) err.status = 502
    if (!err.code) err.code = 'mail_send_failed'
    throw err
  }
  return {
    mode: 'code_sent', challengeId, expiresAt,
    ...(process.env.WEB_EMAIL_OTP_ECHO === '1' && process.env.NODE_ENV !== 'production'
      ? { echoCode: code } : {}),
  }
}

export async function completeEmailCode(input: {
  webAccountId: string; challengeId: string; code: string
  userAgent?: string | null; ip?: string | null; db?: Queryable
}): Promise<{
  webAccountId: string; emailNormalized: string; purpose: 'bind' | 'recover'
  sessionToken: string; csrfToken: string; expiresAt: Date
}> {
  if (!/^[1-9][0-9]{0,18}$/.test(input.challengeId) || !EMAIL_CODE_REGEX.test(input.code)) {
    const err = new Error('Invalid code') as Error & { status?: number; code?: string }
    err.status = 400; err.code = 'invalid_code'; throw err
  }
  for (const key of [
    `email_code_verify_ip:${(input.ip || 'unknown').slice(0, 64)}`,
    `email_code_verify_account:${input.webAccountId}`,
  ]) {
    const limit = await consumeSharedRateLimit(key, 12, 60_000, input.db)
    if (!limit.ok) {
      const err = new Error('Too many attempts') as Error & { status?: number; code?: string }
      err.status = 429; err.code = 'rate_limited'; throw err
    }
  }
  const rows = await db(input.db).query<{
    id: number; web_account_id: string; email_normalized: string
    purpose: 'bind' | 'recover'; code_hash: string
  }>(
    `UPDATE web_email_otps SET attempts = attempts + 1
     WHERE id = $1::bigint AND web_account_id = $2::uuid
       AND purpose = 'bind' AND consumed_at IS NULL
       AND expires_at > now() AND attempts < $3
     RETURNING id, web_account_id::text, email_normalized, purpose, code_hash`,
    [input.challengeId, input.webAccountId, MAX_ATTEMPTS]
  )
  const row = rows.rows[0]
  if (!row || !emailCodeMatches(input.code, row.code_hash.trim())) {
    const err = new Error('Incorrect or expired code') as Error & { status?: number; code?: string }
    err.status = 400; err.code = 'invalid_code'; throw err
  }
  return finishVerifiedEmailChallenge(row, input.userAgent, input.db)
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
