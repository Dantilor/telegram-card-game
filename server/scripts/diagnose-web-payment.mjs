#!/usr/bin/env node
/**
 * Read-only diagnosis of one WEB YooKassa payment on production (gnh_supabase).
 *
 *   PRODUCTION_DATABASE_URL=postgresql://gnh_app:…@host:5432/gnh_supabase?sslmode=verify-full \
 *   node scripts/diagnose-web-payment.mjs --payment-id <yookassa payment id>
 *
 * Session runs with default_transaction_read_only=on inside BEGIN READ ONLY.
 * Output never contains emails, tokens or full identifiers: accounts are shown as
 * a short SHA-256 tag, payment ids as an 8-char prefix.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import pg from 'pg'

const here = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(here, '..')
const EXPECTED_DB = 'gnh_supabase'
const NEW_ACCOUNT_WINDOW_HOURS = 6

export function tag(value) {
  if (value == null || value === '') return null
  return `#${crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 8)}`
}

export function shortId(value) {
  if (value == null || value === '') return null
  const s = String(value)
  return s.length <= 8 ? s : `${s.slice(0, 8)}…`
}

function iso(value) {
  return value ? new Date(value).toISOString() : null
}

export function parseArgs(argv) {
  const i = argv.indexOf('--payment-id')
  const paymentId = i >= 0 ? String(argv[i + 1] || '').trim() : ''
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(paymentId)) {
    throw new Error('Usage: --payment-id <YooKassa payment id>')
  }
  return { paymentId }
}

function assertTarget(raw) {
  let u
  try {
    u = new URL(raw)
  } catch {
    throw new Error('PRODUCTION_DATABASE_URL is not a valid URL')
  }
  const dbName = decodeURIComponent(u.pathname.replace(/^\//, ''))
  if (dbName !== EXPECTED_DB) throw new Error(`Refusing: expected database ${EXPECTED_DB}`)
  const expectHost = (process.env.PRODUCTION_EXPECT_HOST || '').trim()
  if (expectHost && u.hostname.toLowerCase() !== expectHost.toLowerCase()) {
    throw new Error('Refusing: host does not match PRODUCTION_EXPECT_HOST')
  }
}

async function connectReadOnly(databaseUrl) {
  const distPath = path.join(serverRoot, 'dist', 'dbTls.js')
  if (!fs.existsSync(distPath)) throw new Error('Missing dist/dbTls.js — run `npm run build:api` in server/ first')
  const { resolvePgPoolConfig } = await import(pathToFileURL(distPath).href)
  const prev = process.env.DATABASE_URL
  process.env.DATABASE_URL = databaseUrl
  try {
    const resolved = resolvePgPoolConfig(process.env)
    if (!resolved.ssl || resolved.ssl.rejectUnauthorized !== true) {
      throw new Error('Refusing: TLS must verify server certificates')
    }
    const client = new pg.Client({
      connectionString: resolved.connectionString,
      ssl: resolved.ssl,
      connectionTimeoutMillis: 30000,
      options: '-c default_transaction_read_only=on',
    })
    await client.connect()
    return client
  } finally {
    if (prev === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = prev
  }
}

export async function diagnose(client, paymentId) {
  const out = { paymentId: shortId(paymentId) }
  const q = async (sql, params) => (await client.query(sql, params)).rows

  out.dbNow = iso((await q('SELECT now() AS now'))[0].now)

  const [pay] = await q(
    `SELECT id, web_account_id::text AS web_account_id, plan_id, amount_rub, currency, status,
            created_at, paid_at, premium_granted_at,
            receipt_email_normalized IS NOT NULL AS has_receipt_email
       FROM web_payments WHERE id = $1`,
    [paymentId]
  )
  if (!pay) {
    out.webPayment = null
    const tg = await q(
      `SELECT count(*)::int AS n FROM payments WHERE provider_payment_charge_id = $1`,
      [paymentId]
    )
    out.telegramPaymentsRows = tg[0].n
    out.verdict = 'NO_WEB_PAYMENT_ROW'
    return out
  }
  const accountId = pay.web_account_id
  out.webPayment = {
    status: pay.status,
    planId: pay.plan_id,
    amountRub: Number(pay.amount_rub),
    currency: pay.currency,
    createdAt: iso(pay.created_at),
    paidAt: iso(pay.paid_at),
    premiumGrantedAt: iso(pay.premium_granted_at),
    account: tag(accountId),
    hasReceiptEmail: pay.has_receipt_email,
  }

  const [acc] = await q(
    `SELECT a.created_at, a.last_seen_at, a.revoked_at IS NOT NULL AS revoked,
            a.email_verified_at IS NOT NULL AS email_verified,
            (a.email_verified_at IS NOT NULL AND a.email_normalized = p.receipt_email_normalized) AS verified_email_is_receipt,
            a.pending_email_normalized IS NOT NULL AS has_pending_email,
            (a.pending_email_normalized = p.receipt_email_normalized) AS pending_email_is_receipt
       FROM web_accounts a
       JOIN web_payments p ON p.id = $2
      WHERE a.id = $1::uuid`,
    [accountId, paymentId]
  )
  out.payingAccount = acc
    ? {
        account: tag(accountId),
        createdAt: iso(acc.created_at),
        lastSeenAt: iso(acc.last_seen_at),
        revoked: acc.revoked,
        emailVerified: acc.email_verified,
        verifiedEmailIsReceipt: Boolean(acc.verified_email_is_receipt),
        hasPendingEmail: acc.has_pending_email,
        pendingEmailIsReceipt: Boolean(acc.pending_email_is_receipt),
      }
    : null

  const ents = await q(
    `SELECT id, plan_id, source, active_until, created_at, payment_id = $2 AS for_this_payment,
            active_until > now() AS active_now
       FROM web_entitlements
      WHERE web_account_id = $1::uuid
      ORDER BY created_at DESC
      LIMIT 20`,
    [accountId, paymentId]
  )
  out.payingAccountEntitlements = ents.map((e) => ({
    id: Number(e.id),
    planId: e.plan_id,
    source: e.source,
    activeUntil: iso(e.active_until),
    activeNow: e.active_now,
    forThisPayment: Boolean(e.for_this_payment),
    createdAt: iso(e.created_at),
  }))

  const byPayment = await q(
    `SELECT web_account_id::text AS web_account_id, source, active_until > now() AS active_now
       FROM web_entitlements WHERE payment_id = $1`,
    [paymentId]
  )
  out.entitlementsForPayment = {
    count: byPayment.length,
    accounts: [...new Set(byPayment.map((r) => tag(r.web_account_id)))],
    allOnPayingAccount: byPayment.every((r) => r.web_account_id === accountId),
  }

  const [link] = await q(
    `SELECT count(*)::int AS n FROM web_telegram_links WHERE web_account_id = $1::uuid AND revoked_at IS NULL`,
    [accountId]
  )
  out.payingAccountTelegramLinked = link.n > 0

  const [sess] = await q(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE revoked_at IS NULL AND expires_at > now())::int AS active,
            max(created_at) AS last_created, max(last_seen_at) AS last_seen,
            count(DISTINCT user_agent_hash)::int AS user_agents
       FROM web_sessions WHERE web_account_id = $1::uuid`,
    [accountId]
  )
  out.payingAccountSessions = {
    total: sess.total,
    active: sess.active,
    lastCreatedAt: iso(sess.last_created),
    lastSeenAt: iso(sess.last_seen),
    distinctUserAgents: sess.user_agents,
  }

  const newer = await q(
    `SELECT a.id::text AS id, a.created_at, a.last_seen_at,
            EXISTS (
              SELECT 1 FROM web_sessions s
               WHERE s.web_account_id = a.id
                 AND s.user_agent_hash IN (
                   SELECT user_agent_hash FROM web_sessions
                    WHERE web_account_id = $1::uuid AND user_agent_hash IS NOT NULL
                 )
            ) AS same_user_agent,
            EXISTS (
              SELECT 1 FROM web_entitlements e WHERE e.web_account_id = a.id AND e.active_until > now()
            ) AS has_active_entitlement
       FROM web_accounts a
      WHERE a.id <> $1::uuid
        AND a.created_at BETWEEN $2::timestamptz AND $2::timestamptz + make_interval(hours => $3)
      ORDER BY a.created_at ASC
      LIMIT 50`,
    [accountId, pay.created_at, NEW_ACCOUNT_WINDOW_HOURS]
  )
  out.accountsCreatedAfterPayment = {
    windowHours: NEW_ACCOUNT_WINDOW_HOURS,
    count: newer.length,
    sameUserAgentAsPayer: newer
      .filter((r) => r.same_user_agent)
      .map((r) => ({
        account: tag(r.id),
        createdAt: iso(r.created_at),
        lastSeenAt: iso(r.last_seen_at),
        hasActiveEntitlement: r.has_active_entitlement,
      })),
  }

  const tg = await q(
    `SELECT count(*)::int AS n FROM payments WHERE provider_payment_charge_id = $1`,
    [paymentId]
  )
  out.telegramPaymentsRows = tg[0].n

  const activeForThis = out.payingAccountEntitlements.some((e) => e.forThisPayment && e.activeNow)
  const granted = pay.status === 'succeeded' && Boolean(pay.premium_granted_at)
  if (!granted) out.verdict = 'NOT_GRANTED_IN_DB'
  else if (!activeForThis) out.verdict = 'GRANTED_BUT_ENTITLEMENT_NOT_ACTIVE'
  else if (out.accountsCreatedAfterPayment.sameUserAgentAsPayer.length > 0) {
    out.verdict = 'GRANTED_OK__BROWSER_LIKELY_ON_NEW_ACCOUNT'
  } else out.verdict = 'GRANTED_OK__CHECK_CLIENT_SESSION'
  return out
}

async function main() {
  const { paymentId } = parseArgs(process.argv.slice(2))
  const url = String(process.env.PRODUCTION_DATABASE_URL || '').trim()
  if (!url) throw new Error('Set PRODUCTION_DATABASE_URL')
  assertTarget(url)
  const client = await connectReadOnly(url)
  try {
    await client.query('BEGIN READ ONLY')
    const [ro] = (await client.query('SHOW transaction_read_only')).rows
    if (ro.transaction_read_only !== 'on') throw new Error('Refusing: session is not read-only')
    const result = await diagnose(client, paymentId)
    await client.query('ROLLBACK')
    console.log(JSON.stringify(result, null, 2))
  } finally {
    await client.end()
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`diagnose-web-payment failed: ${e instanceof Error ? e.message : String(e)}`)
    process.exit(1)
  })
}