import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import type { Queryable } from '../legal/types.js'
import {
  afterWebPurchasePaid,
  completeEmailMagicLink,
  normalizeEmail,
  savePaymentReceiptEmail,
  startEmailBind,
  startEmailRecover,
} from './webEmailOtp.js'
import { getWebAccountContact, getWebAccountPremium, grantWebEntitlement } from './webAccounts.js'
import { resetMailTransportCache } from '../services/mailTransport.js'
import { sha256Hex } from './cryptoTokens.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(here, '../..')

function readSql(relativePath: string): string {
  return fs.readFileSync(path.join(serverRoot, relativePath), 'utf8')
}

async function createHarness() {
  process.env.WEB_EMAIL_OTP_ECHO = '1'
  process.env.NODE_ENV = 'test'
  delete process.env.SMTP_ENABLED
  resetMailTransportCache()

  const pg = new PGlite()
  await pg.exec(readSql('db/schema.sql'))
  await pg.exec(readSql('db/migrations/012_web_sessions.sql'))
  await pg.exec(readSql('db/migrations/013_web_session_profile.sql'))
  await pg.exec(readSql('db/migrations/017_web_anonymous_accounts.sql'))
  await pg.exec(readSql('db/migrations/018_web_rate_buckets.sql'))
  await pg.exec(readSql('db/migrations/020_web_email_magic_links.sql'))
  const query: Queryable = {
    query: async (sql, params) => {
      const result = await pg.query(sql, params)
      return { rows: result.rows as Record<string, unknown>[] }
    },
  }
  return {
    query,
    close: () => pg.close(),
  }
}

async function newAccount(q: Queryable): Promise<string> {
  const r = await q.query<{ id: string }>(`INSERT INTO web_accounts DEFAULT VALUES RETURNING id`)
  return String(r.rows[0]!.id)
}

async function countSessions(q: Queryable, accountId: string): Promise<number> {
  const r = await q.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM web_sessions WHERE web_account_id = $1::uuid`,
    [accountId]
  )
  return Number(r.rows[0]!.c)
}

async function otpRow(q: Queryable, token: string) {
  const r = await q.query<{ purpose: string; web_account_id: string }>(
    `SELECT purpose, web_account_id::text AS web_account_id FROM web_email_otps WHERE code_hash = $1`,
    [sha256Hex(token)]
  )
  return r.rows[0]!
}
const otpPurpose = async (q: Queryable, token: string) => (await otpRow(q, token)).purpose
const otpAccount = async (q: Queryable, token: string) => (await otpRow(q, token)).web_account_id

/** Paid WEB purchase on `accountId` with the receipt sent to `email` (as the YooKassa route stores it). */
async function paidPurchase(
  q: Queryable,
  accountId: string,
  email: string,
  opts: { id?: string; status?: string; activeDays?: number } = {}
): Promise<{ paymentId: string; activeUntil: Date }> {
  const paymentId = opts.id ?? `329907be-000f-5001-9000-${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`
  const activeUntil = new Date(Date.now() + (opts.activeDays ?? 30) * 86400_000)
  await q.query(
    `INSERT INTO web_payments (id, web_account_id, plan_id, amount_rub, status, paid_at, premium_granted_at, receipt_email_normalized)
     VALUES ($1, $2::uuid, 'premium_web_1m', 259, $3, now(), now(), $4)`,
    [paymentId, accountId, opts.status ?? 'succeeded', email]
  )
  await grantWebEntitlement({
    webAccountId: accountId,
    planId: 'premium_web_1m',
    activeUntil,
    source: 'web_purchase',
    paymentId,
    db: q,
  })
  return { paymentId, activeUntil }
}

async function entitlementSnapshot(q: Queryable, accountId: string) {
  const r = await q.query<{ n: string; until: string | null }>(
    `SELECT count(*)::text AS n, max(active_until)::text AS until FROM web_entitlements WHERE web_account_id = $1::uuid`,
    [accountId]
  )
  return r.rows[0]!
}
test('normalizeEmail rejects garbage', () => {
  assert.equal(normalizeEmail('  a@b.co  '), 'a@b.co')
  assert.equal(normalizeEmail('not-an-email'), null)
})

test('receipt email saved on paid purchase; pending until magic confirm; no auto-verify', async () => {
  const harness = await createHarness()
  try {
    const account = await harness.query.query<{ id: string }>(
      `INSERT INTO web_accounts DEFAULT VALUES RETURNING id`
    )
    const webAccountId = String(account.rows[0]!.id)
    const paymentId = 'pay_receipt_1'
    await harness.query.query(
      `INSERT INTO web_payments (id, web_account_id, plan_id, amount_rub, status, premium_granted_at)
       VALUES ($1, $2::uuid, 'premium_1m', 259, 'succeeded', now())`,
      [paymentId, webAccountId]
    )
    await grantWebEntitlement({
      webAccountId,
      planId: 'premium_1m',
      activeUntil: new Date(Date.now() + 30 * 86400_000),
      source: 'web_purchase',
      paymentId,
      db: harness.query,
    })

    const saved = await savePaymentReceiptEmail({
      paymentId,
      email: 'Buyer@Example.com',
      db: harness.query,
    })
    assert.equal(saved, 'buyer@example.com')

    const after = await afterWebPurchasePaid({
      webAccountId,
      paymentId,
      bindAccountEmail: true,
      db: harness.query,
    })
    assert.equal(after.pendingEmail, 'buyer@example.com')
    assert.equal(after.linkSent, false, 'no SMTP after purchase — only pending opt-in')

    const contact = await getWebAccountContact(webAccountId, harness.query)
    assert.equal(contact.email, 'buyer@example.com')
    assert.equal(contact.emailVerified, false)
    assert.equal(contact.emailPending, true)

    const otpAfterPay = await harness.query.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM web_email_otps WHERE web_account_id = $1::uuid`,
      [webAccountId]
    )
    assert.equal(otpAfterPay.rows[0]!.c, '0', 'no magic link sent on payment')

    // User later requests login link explicitly.
    const started = await startEmailRecover({
      email: 'buyer@example.com',
      db: harness.query,
    })
    assert.ok(started.echoToken)

    const completed = await completeEmailMagicLink({
      token: started.echoToken!,
      db: harness.query,
    })
    assert.equal(completed.webAccountId, webAccountId)
    assert.equal(completed.emailNormalized, 'buyer@example.com')

    const verified = await getWebAccountContact(webAccountId, harness.query)
    assert.equal(verified.emailVerified, true)
    assert.equal(verified.emailPending, false)

    const premium = await getWebAccountPremium(webAccountId, harness.query)
    assert.equal(premium.isPremium, true)
  } finally {
    await harness.close()
  }
})

test('recover after cookie loss restores same account and Premium', async () => {
  const harness = await createHarness()
  try {
    const account = await harness.query.query<{ id: string }>(
      `INSERT INTO web_accounts DEFAULT VALUES RETURNING id`
    )
    const webAccountId = String(account.rows[0]!.id)
    await harness.query.query(
      `UPDATE web_accounts
          SET email_normalized = 'owner@example.com',
              email_verified_at = now()
        WHERE id = $1::uuid`,
      [webAccountId]
    )
    await grantWebEntitlement({
      webAccountId,
      planId: 'premium_3m',
      activeUntil: new Date(Date.now() + 90 * 86400_000),
      source: 'web_purchase',
      paymentId: 'pay_recover_1',
      db: harness.query,
    })

    const started = await startEmailRecover({
      email: 'owner@example.com',
      db: harness.query,
    })
    assert.ok(started.echoToken)

    const recovered = await completeEmailMagicLink({
      token: started.echoToken!,
      db: harness.query,
    })
    assert.equal(recovered.webAccountId, webAccountId)

    const premium = await getWebAccountPremium(webAccountId, harness.query)
    assert.equal(premium.isPremium, true)
    assert.ok(premium.sources.includes('web_purchase'))
  } finally {
    await harness.close()
  }
})

test('entering a known email sends a sign-in link; no session is issued by the address alone', async () => {
  const harness = await createHarness()
  try {
    const accountA = await newAccount(harness.query)
    const accountB = await newAccount(harness.query)
    await harness.query.query(
      `UPDATE web_accounts
          SET email_normalized = 'taken@example.com',
              email_verified_at = now()
        WHERE id = $1::uuid`,
      [accountA]
    )
    await grantWebEntitlement({
      webAccountId: accountA,
      planId: 'premium_1m',
      activeUntil: new Date(Date.now() + 30 * 86400_000),
      source: 'web_purchase',
      paymentId: 'pay_restore_email',
      db: harness.query,
    })
    const sessionsBefore = await countSessions(harness.query, accountA)

    const started = await startEmailBind({ webAccountId: accountB, email: 'taken@example.com', db: harness.query })
    assert.deepEqual(Object.keys(started).sort(), ['echoToken', 'expiresAt', 'mode'])
    assert.equal(started.mode, 'verify_sent')
    assert.equal(await countSessions(harness.query, accountA), sessionsBefore, 'no session for A without the link')
    assert.equal(await otpPurpose(harness.query, started.echoToken!), 'recover')

    const completed = await completeEmailMagicLink({ token: started.echoToken!, db: harness.query })
    assert.equal(completed.webAccountId, accountA)
    assert.equal((await getWebAccountPremium(accountA, harness.query)).isPremium, true)
    assert.equal((await getWebAccountPremium(accountB, harness.query)).isPremium, false)
  } finally {
    await harness.close()
  }
})
test('paid receipt and checkout opt-in both lead to the same account; no duplicate Premium', async () => {
  const harness = await createHarness()
  try {
    const account = await harness.query.query<{ id: string }>(
      `INSERT INTO web_accounts DEFAULT VALUES RETURNING id`
    )
    const webAccountId = String(account.rows[0]!.id)
    const paymentId = 'pay_idem_1'
    await harness.query.query(
      `INSERT INTO web_payments (id, web_account_id, plan_id, amount_rub, status, premium_granted_at, receipt_email_normalized)
       VALUES ($1, $2::uuid, 'premium_1m', 259, 'succeeded', now(), 'late@example.com')`,
      [paymentId, webAccountId]
    )
    await grantWebEntitlement({
      webAccountId,
      planId: 'premium_1m',
      activeUntil: new Date(Date.now() + 30 * 86400_000),
      source: 'web_purchase',
      paymentId,
      db: harness.query,
    })

    const skipped = await afterWebPurchasePaid({
      webAccountId,
      paymentId,
      bindAccountEmail: false,
      db: harness.query,
    })
    assert.equal(skipped.pendingEmail, null)
    const bare = await startEmailRecover({ email: 'late@example.com', db: harness.query })
    assert.ok(bare.echoToken, 'paid receipt with an active entitlement is recoverable via the mailbox')
    assert.equal(await otpAccount(harness.query, bare.echoToken!), webAccountId)

    await afterWebPurchasePaid({ webAccountId, paymentId, bindAccountEmail: true, db: harness.query })
    await afterWebPurchasePaid({ webAccountId, paymentId, bindAccountEmail: true, db: harness.query })

    const ents = await harness.query.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM web_entitlements WHERE web_account_id = $1::uuid`,
      [webAccountId]
    )
    assert.equal(ents.rows[0]!.c, '1', 'no duplicate entitlements')

    const recover = await startEmailRecover({
      email: 'late@example.com',
      db: harness.query,
    })
    assert.ok(recover.echoToken)
    const completed = await completeEmailMagicLink({
      token: recover.echoToken!,
      db: harness.query,
    })
    assert.equal(completed.webAccountId, webAccountId)

    const premium = await getWebAccountPremium(webAccountId, harness.query)
    assert.equal(premium.isPremium, true)

    const entsAfter = await harness.query.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM web_entitlements WHERE web_account_id = $1::uuid`,
      [webAccountId]
    )
    assert.equal(entsAfter.rows[0]!.c, '1', 'old purchase kept, not duplicated')
  } finally {
    await harness.close()
  }
})

test('paid receipt does not overwrite a different verified login email', async () => {
  const harness = await createHarness()
  try {
    const account = await harness.query.query<{ id: string }>(
      `INSERT INTO web_accounts DEFAULT VALUES RETURNING id`
    )
    const webAccountId = String(account.rows[0]!.id)
    await harness.query.query(
      `UPDATE web_accounts
          SET email_normalized = 'owner@example.com',
              email_verified_at = now()
        WHERE id = $1::uuid`,
      [webAccountId]
    )
    const paymentId = 'pay_receipt_other'
    await harness.query.query(
      `INSERT INTO web_payments (id, web_account_id, plan_id, amount_rub, status, premium_granted_at, receipt_email_normalized)
       VALUES ($1, $2::uuid, 'premium_1m', 259, 'succeeded', now(), 'receipt@example.com')`,
      [paymentId, webAccountId]
    )

    const after = await afterWebPurchasePaid({
      webAccountId,
      paymentId,
      bindAccountEmail: true,
      db: harness.query,
    })
    assert.equal(after.linkSent, false)
    assert.equal(after.pendingEmail, null)

    const skipped = await afterWebPurchasePaid({
      webAccountId,
      paymentId,
      bindAccountEmail: false,
      db: harness.query,
    })
    assert.equal(skipped.linkSent, false)
    assert.equal(skipped.pendingEmail, null)

    const contact = await getWebAccountContact(webAccountId, harness.query)
    assert.equal(contact.email, 'owner@example.com')
    assert.equal(contact.emailVerified, true)

    // Stale bind OTP without pending rebind must not replace verified login email.
    const staleToken = 'stale_bind_token_xxxxxxxxxxxxxxxx'
    await harness.query.query(
      `INSERT INTO web_email_otps (web_account_id, email_normalized, code_hash, purpose, expires_at)
       VALUES ($1::uuid, 'receipt@example.com', $2, 'bind', now() + interval '30 minutes')`,
      [webAccountId, sha256Hex(staleToken)]
    )
    await assert.rejects(
      () => completeEmailMagicLink({ token: staleToken, db: harness.query }),
      (err: Error & { code?: string }) => err.code === 'email_already_verified'
    )

    const still = await getWebAccountContact(webAccountId, harness.query)
    assert.equal(still.email, 'owner@example.com')
    assert.equal(still.emailVerified, true)
  } finally {
    await harness.close()
  }
})

test('reused magic link is rejected', async () => {
  const harness = await createHarness()
  try {
    const account = await harness.query.query<{ id: string }>(
      `INSERT INTO web_accounts DEFAULT VALUES RETURNING id`
    )
    const webAccountId = String(account.rows[0]!.id)
    const started = await startEmailBind({
      webAccountId,
      email: 'once@example.com',
      db: harness.query,
    })
    assert.ok(started.echoToken)
    await completeEmailMagicLink({ token: started.echoToken!, db: harness.query })
    await assert.rejects(
      () => completeEmailMagicLink({ token: started.echoToken!, db: harness.query }),
      (err: Error & { code?: string }) => err.code === 'token_invalid'
    )
  } finally {
    await harness.close()
  }
})

test('new account without Premium: email is confirmed by link, nothing else changes', async () => {
  const harness = await createHarness()
  try {
    const account = await newAccount(harness.query)
    const started = await startEmailBind({ webAccountId: account, email: 'Fresh@Example.com', db: harness.query })
    assert.equal(started.mode, 'verify_sent')
    assert.equal(await otpPurpose(harness.query, started.echoToken!), 'bind')
    const before = await getWebAccountContact(account, harness.query)
    assert.equal(before.email, null, 'nothing is saved before the mailbox is confirmed')

    const done = await completeEmailMagicLink({ token: started.echoToken!, db: harness.query })
    assert.equal(done.webAccountId, account)
    const contact = await getWebAccountContact(account, harness.query)
    assert.equal(contact.email, 'fresh@example.com')
    assert.equal(contact.emailVerified, true)
    assert.equal((await getWebAccountPremium(account, harness.query)).isPremium, false)

    const again = await startEmailBind({ webAccountId: account, email: 'fresh@example.com', db: harness.query })
    assert.deepEqual(again, { mode: 'verified' }, 'already confirmed: no new mail')
  } finally {
    await harness.close()
  }
})

test('historical anonymous purchase (receipt email only): new device restores it after the link, same term', async () => {
  const harness = await createHarness()
  try {
    const buyer = await newAccount(harness.query)
    const { paymentId } = await paidPurchase(harness.query, buyer, 'payer@example.com', {
      id: '329907be-000f-5001-9000-1c462a858f03',
    })
    const ent = await entitlementSnapshot(harness.query, buyer)
    // Return from YooKassa without cookies created a second anonymous account.
    const second = await newAccount(harness.query)

    const started = await startEmailBind({ webAccountId: second, email: 'payer@example.com', db: harness.query })
    assert.equal(started.mode, 'verify_sent')
    assert.equal(await otpAccount(harness.query, started.echoToken!), buyer, 'link signs into the paying account')
    assert.equal((await getWebAccountPremium(second, harness.query)).isPremium, false)

    const done = await completeEmailMagicLink({ token: started.echoToken!, db: harness.query })
    assert.equal(done.webAccountId, buyer)
    assert.equal(done.purpose, 'recover')
    const premium = await getWebAccountPremium(buyer, harness.query)
    assert.equal(premium.isPremium, true)
    assert.deepEqual(await entitlementSnapshot(harness.query, buyer), ent, 'no new grant, term unchanged')
    assert.equal((await getWebAccountPremium(second, harness.query)).isPremium, false, 'Premium is not copied')
    const contact = await getWebAccountContact(buyer, harness.query)
    assert.equal(contact.emailVerified, true)

    // Logging in again from a third device: no extension, no duplicate.
    const third = await newAccount(harness.query)
    const again = await startEmailBind({ webAccountId: third, email: 'payer@example.com', db: harness.query })
    assert.equal(await otpAccount(harness.query, again.echoToken!), buyer)
    await completeEmailMagicLink({ token: again.echoToken!, db: harness.query })
    assert.deepEqual(await entitlementSnapshot(harness.query, buyer), ent)
    const pays = await harness.query.query<{ c: string }>(`SELECT count(*)::text AS c FROM web_payments WHERE id = $1`, [paymentId])
    assert.equal(pays.rows[0]!.c, '1')
  } finally {
    await harness.close()
  }
})

test('login page on another device finds the historical purchase too', async () => {
  const harness = await createHarness()
  try {
    const buyer = await newAccount(harness.query)
    await paidPurchase(harness.query, buyer, 'device2@example.com')
    const started = await startEmailRecover({ email: 'device2@example.com', db: harness.query })
    assert.ok(started.echoToken)
    const done = await completeEmailMagicLink({ token: started.echoToken!, db: harness.query })
    assert.equal(done.webAccountId, buyer)
    assert.equal((await getWebAccountPremium(buyer, harness.query)).isPremium, true)
  } finally {
    await harness.close()
  }
})

test('same response for registered and unknown addresses; caller account untouched before the link', async () => {
  const harness = await createHarness()
  try {
    const owner = await newAccount(harness.query)
    await paidPurchase(harness.query, owner, 'known@example.com')
    const caller = await newAccount(harness.query)
    const contactBefore = await getWebAccountContact(caller, harness.query)

    const known = await startEmailBind({ webAccountId: caller, email: 'known@example.com', db: harness.query })
    const unknown = await startEmailBind({ webAccountId: caller, email: 'nobody@example.com', db: harness.query })
    assert.deepEqual(Object.keys(known).sort(), Object.keys(unknown).sort())
    assert.equal(known.mode, unknown.mode)
    assert.deepEqual(await getWebAccountContact(caller, harness.query), contactBefore)
  } finally {
    await harness.close()
  }
})

test("someone else's purchase cannot be taken by typing the email: only the mailbox link works", async () => {
  const harness = await createHarness()
  try {
    const victim = await newAccount(harness.query)
    await paidPurchase(harness.query, victim, 'victim@example.com')
    const attacker = await newAccount(harness.query)
    const victimSessions = await countSessions(harness.query, victim)

    const started = await startEmailBind({ webAccountId: attacker, email: 'victim@example.com', db: harness.query })
    assert.equal('sessionToken' in started, false)
    assert.equal(await countSessions(harness.query, victim), victimSessions)
    assert.equal((await getWebAccountPremium(attacker, harness.query)).isPremium, false)
    await assert.rejects(
      () => completeEmailMagicLink({ token: 'guessed_token_xxxxxxxxxxxxxxxxxxxx', db: harness.query }),
      (err: Error & { code?: string }) => err.code === 'token_invalid'
    )
    assert.equal(await countSessions(harness.query, victim), victimSessions)
  } finally {
    await harness.close()
  }
})

test('receipt recovery is limited to paid, active, unclaimed anonymous purchases', async () => {
  const harness = await createHarness()
  try {
    const expectBind = async (email: string, why: string) => {
      const caller = await newAccount(harness.query)
      const s = await startEmailBind({ webAccountId: caller, email, db: harness.query })
      assert.equal(await otpPurpose(harness.query, s.echoToken!), 'bind', why)
      assert.equal(await otpAccount(harness.query, s.echoToken!), caller, why)
    }

    const unpaid = await newAccount(harness.query)
    await harness.query.query(
      `INSERT INTO web_payments (id, web_account_id, plan_id, amount_rub, status, receipt_email_normalized)
       VALUES ('pay_unpaid_1', $1::uuid, 'premium_web_1m', 259, 'pending', 'unpaid@example.com')`,
      [unpaid]
    )
    await expectBind('unpaid@example.com', 'pending payment is not a purchase')

    const refunded = await newAccount(harness.query)
    const r = await paidPurchase(harness.query, refunded, 'refunded@example.com', { status: 'refunded' })
    await harness.query.query(`UPDATE web_entitlements SET active_until = now() - interval '1 minute' WHERE payment_id = $1`, [r.paymentId])
    await expectBind('refunded@example.com', 'refunded purchase is not recoverable')

    const expired = await newAccount(harness.query)
    await paidPurchase(harness.query, expired, 'expired@example.com', { activeDays: -1 })
    await expectBind('expired@example.com', 'expired Premium has nothing to restore')

    const tgLinked = await newAccount(harness.query)
    await paidPurchase(harness.query, tgLinked, 'tg@example.com')
    await harness.query.query(`INSERT INTO web_telegram_links (web_account_id, telegram_id) VALUES ($1::uuid, 4242)`, [tgLinked])
    await expectBind('tg@example.com', 'Telegram-linked accounts recover via Telegram')

    const claimed = await newAccount(harness.query)
    await harness.query.query(
      `UPDATE web_accounts SET email_normalized = 'owner2@example.com', email_verified_at = now() WHERE id = $1::uuid`,
      [claimed]
    )
    await paidPurchase(harness.query, claimed, 'gift@example.com')
    await expectBind('gift@example.com', 'account with its own login email is not handed to the receipt address')

    const squatter = await newAccount(harness.query)
    await harness.query.query(`UPDATE web_accounts SET pending_email_normalized = 'squat@example.com' WHERE id = $1::uuid`, [squatter])
    await expectBind('squat@example.com', 'unverified pending contact without Premium is not a sign-in target')
  } finally {
    await harness.close()
  }
})

test('a recover link cannot overwrite a login email confirmed after it was sent', async () => {
  const harness = await createHarness()
  try {
    const buyer = await newAccount(harness.query)
    await paidPurchase(harness.query, buyer, 'late-claim@example.com')
    const started = await startEmailRecover({ email: 'late-claim@example.com', db: harness.query })
    assert.ok(started.echoToken)
    await harness.query.query(
      `UPDATE web_accounts SET email_normalized = 'real-owner@example.com', email_verified_at = now() WHERE id = $1::uuid`,
      [buyer]
    )
    await assert.rejects(
      () => completeEmailMagicLink({ token: started.echoToken!, db: harness.query }),
      (err: Error & { code?: string }) => err.code === 'email_already_verified'
    )
    assert.equal((await getWebAccountContact(buyer, harness.query)).email, 'real-owner@example.com')
  } finally {
    await harness.close()
  }
})