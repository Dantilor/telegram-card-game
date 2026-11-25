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
  saveProfileContactEmail,
  startEmailBind,
  startEmailRecover,
} from './webEmailOtp.js'
import {
  getOwnReceiptEmailHint,
  getWebAccountContact,
  getWebAccountPremium,
  grantWebEntitlement,
  revokeWebPurchaseEntitlements,
} from './webAccounts.js'
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

    // Later the buyer signs in on /login without that guest session: the confirmed
    // mailbox gets its own account with the purchase; the guest account stays as it was.
    const started = await startEmailRecover({ email: 'buyer@example.com', db: harness.query })
    assert.ok(started.echoToken)
    assert.equal(await otpPurpose(harness.query, started.echoToken!), 'bind')
    assert.notEqual(await otpAccount(harness.query, started.echoToken!), webAccountId)

    const completed = await completeEmailMagicLink({ token: started.echoToken!, db: harness.query })
    assert.notEqual(completed.webAccountId, webAccountId)
    assert.equal(completed.emailNormalized, 'buyer@example.com')
    assert.equal((await getWebAccountContact(completed.webAccountId, harness.query)).emailVerified, true)
    assert.equal((await getWebAccountPremium(completed.webAccountId, harness.query)).isPremium, true)

    assert.deepEqual(await getWebAccountContact(webAccountId, harness.query), contact)
    assert.equal(await countSessions(harness.query, webAccountId), 0)
    assert.equal((await getWebAccountPremium(webAccountId, harness.query)).isPremium, true)
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
    assert.equal(skipped.pendingEmail, 'late@example.com', 'receipt email is saved automatically, even without opt-in')
    assert.equal((await getWebAccountContact(webAccountId, harness.query)).emailVerified, false)
    const bare = await startEmailRecover({ email: 'late@example.com', db: harness.query })
    assert.ok(bare.echoToken, 'a login link always goes to the mailbox')
    const loginAccount = await otpAccount(harness.query, bare.echoToken!)
    assert.notEqual(loginAccount, webAccountId, 'the receipt never targets the paying guest account')

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
    assert.equal(await otpAccount(harness.query, recover.echoToken!), loginAccount, 'no second empty account')
    const completed = await completeEmailMagicLink({ token: recover.echoToken!, db: harness.query })
    assert.equal(completed.webAccountId, loginAccount)
    assert.equal((await getWebAccountPremium(loginAccount, harness.query)).isPremium, true)

    const again = await startEmailRecover({ email: 'late@example.com', db: harness.query })
    assert.equal(await otpPurpose(harness.query, again.echoToken!), 'recover')
    assert.equal(await otpAccount(harness.query, again.echoToken!), loginAccount)

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

async function verifyEmail(q: Queryable, accountId: string, email: string): Promise<void> {
  await q.query(
    `UPDATE web_accounts SET email_normalized = $2, email_verified_at = now() WHERE id = $1::uuid`,
    [accountId, email]
  )
}

async function confirmViaProfile(q: Queryable, accountId: string, email: string) {
  const started = await startEmailBind({ webAccountId: accountId, email, db: q })
  assert.equal(started.mode, 'verify_sent')
  return completeEmailMagicLink({ token: started.echoToken!, db: q })
}

async function allEntitlements(q: Queryable) {
  const r = await q.query<{ id: string; web_account_id: string; payment_id: string | null; active_until: string }>(
    `SELECT id::text, web_account_id::text, payment_id, active_until::text FROM web_entitlements ORDER BY id`
  )
  return r.rows
}

async function verifiedAccountsFor(q: Queryable, email: string): Promise<number> {
  const r = await q.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM web_accounts WHERE email_normalized = $1 AND email_verified_at IS NOT NULL`,
    [email]
  )
  return Number(r.rows[0]!.c)
}

test('real purchase 329907be: guest paid, cookies lost, new device confirms the receipt email → Premium, same term', async () => {
  const harness = await createHarness()
  try {
    const buyer = await newAccount(harness.query)
    const { paymentId, activeUntil } = await paidPurchase(harness.query, buyer, 'payer@example.com', {
      id: '329907be-000f-5001-9000-1c462a858f03',
    })
    const before = await allEntitlements(harness.query)
    // Return from YooKassa without cookies created a second anonymous account.
    const second = await newAccount(harness.query)
    assert.equal((await getWebAccountPremium(second, harness.query)).isPremium, false)

    const done = await confirmViaProfile(harness.query, second, 'payer@example.com')
    assert.equal(done.webAccountId, second, 'the current guest becomes the account of this email')
    const premium = await getWebAccountPremium(second, harness.query)
    assert.equal(premium.isPremium, true)
    assert.equal(premium.activeUntil, activeUntil.toISOString(), 'original term, not extended')
    assert.equal((await getWebAccountPremium(buyer, harness.query)).isPremium, true, 'paying device keeps it')

    // A third device signs into the same account; nothing is granted or copied.
    const third = await newAccount(harness.query)
    const again = await confirmViaProfile(harness.query, third, 'payer@example.com')
    assert.equal(again.webAccountId, second)
    assert.equal(again.purpose, 'recover')
    assert.deepEqual(await allEntitlements(harness.query), before, 'no new or changed entitlements')
    assert.equal(await verifiedAccountsFor(harness.query, 'payer@example.com'), 1)
    const pays = await harness.query.query<{ c: string; acc: string }>(
      `SELECT count(*)::text AS c, max(web_account_id::text) AS acc FROM web_payments WHERE id = $1`,
      [paymentId]
    )
    assert.equal(pays.rows[0]!.c, '1')
    assert.equal(pays.rows[0]!.acc, buyer, 'payment keeps its original owner for audit and refunds')
  } finally {
    await harness.close()
  }
})

test('real purchase 329907be with an existing verified account on that email: Premium shows there', async () => {
  const harness = await createHarness()
  try {
    const main = await newAccount(harness.query)
    await verifyEmail(harness.query, main, 'payer@example.com')
    assert.equal((await getWebAccountPremium(main, harness.query)).isPremium, false)

    const guest = await newAccount(harness.query)
    const { activeUntil } = await paidPurchase(harness.query, guest, 'payer@example.com', {
      id: '329907be-000f-5001-9000-1c462a858f03',
    })

    const premium = await getWebAccountPremium(main, harness.query)
    assert.equal(premium.isPremium, true)
    assert.equal(premium.activeUntil, activeUntil.toISOString())
    assert.deepEqual(premium.sources, ['web_purchase'])

    const device = await newAccount(harness.query)
    const done = await confirmViaProfile(harness.query, device, 'payer@example.com')
    assert.equal(done.webAccountId, main, 'existing account is reused, not a second one')
    assert.equal(await verifiedAccountsFor(harness.query, 'payer@example.com'), 1)
    assert.equal((await getWebAccountPremium(device, harness.query)).isPremium, false)
  } finally {
    await harness.close()
  }
})

test('several guest purchases on one receipt email: all count, refunds recalc, nothing summed', async () => {
  const harness = await createHarness()
  try {
    const main = await newAccount(harness.query)
    await verifyEmail(harness.query, main, 'many@example.com')
    const g1 = await newAccount(harness.query)
    const g2 = await newAccount(harness.query)
    const p1 = await paidPurchase(harness.query, g1, 'many@example.com', { activeDays: 30 })
    const p2 = await paidPurchase(harness.query, g2, 'many@example.com', { activeDays: 60 })

    let premium = await getWebAccountPremium(main, harness.query)
    assert.equal(premium.activeUntil, p2.activeUntil.toISOString(), 'longest purchase, terms are not added up')

    // Full refund of the longer purchase, exactly as the webhook does it.
    await harness.query.query(`UPDATE web_payments SET status = 'refunded' WHERE id = $1`, [p2.paymentId])
    await revokeWebPurchaseEntitlements({ paymentId: p2.paymentId, db: harness.query })
    premium = await getWebAccountPremium(main, harness.query)
    assert.equal(premium.isPremium, true)
    assert.equal(premium.activeUntil, p1.activeUntil.toISOString(), 'the other purchase is still there')

    await harness.query.query(`UPDATE web_payments SET status = 'canceled' WHERE id = $1`, [p1.paymentId])
    await revokeWebPurchaseEntitlements({ paymentId: p1.paymentId, db: harness.query })
    premium = await getWebAccountPremium(main, harness.query)
    assert.equal(premium.isPremium, false)
    assert.equal(premium.lastEndedAt, null, 'refunded purchases do not even show as ended Premium')
  } finally {
    await harness.close()
  }
})

test('partial refund keeps access; Lifetime stays lifetime', async () => {
  const harness = await createHarness()
  try {
    const main = await newAccount(harness.query)
    await verifyEmail(harness.query, main, 'life@example.com')
    const g1 = await newAccount(harness.query)
    const part = await paidPurchase(harness.query, g1, 'life@example.com', { status: 'partially_refunded' })
    assert.equal((await getWebAccountPremium(main, harness.query)).isPremium, true)
    await revokeWebPurchaseEntitlements({ paymentId: part.paymentId, db: harness.query })

    const g2 = await newAccount(harness.query)
    const until = new Date('2126-01-01T00:00:00.000Z')
    await harness.query.query(
      `INSERT INTO web_payments (id, web_account_id, plan_id, amount_rub, status, paid_at, premium_granted_at, receipt_email_normalized)
       VALUES ('pay_lifetime_1', $1::uuid, 'premium_web_lifetime', 1990, 'succeeded', now(), now(), 'life@example.com')`,
      [g2]
    )
    await grantWebEntitlement({
      webAccountId: g2,
      planId: 'premium_web_lifetime',
      activeUntil: until,
      source: 'web_purchase',
      paymentId: 'pay_lifetime_1',
      db: harness.query,
    })
    const premium = await getWebAccountPremium(main, harness.query)
    assert.equal(premium.isPremium, true)
    assert.equal(premium.isLifetime, true)
    assert.equal(premium.activeUntil, until.toISOString())
  } finally {
    await harness.close()
  }
})

test('repeated and simultaneous confirmations end in one account without duplicates', async () => {
  const harness = await createHarness()
  try {
    const buyer = await newAccount(harness.query)
    await paidPurchase(harness.query, buyer, 'race@example.com')
    const before = await allEntitlements(harness.query)
    const c1 = await newAccount(harness.query)
    const c2 = await newAccount(harness.query)
    // Both links are sent while nobody has verified the address yet.
    const s1 = await startEmailBind({ webAccountId: c1, email: 'race@example.com', db: harness.query })
    const s2 = await startEmailBind({ webAccountId: c2, email: 'race@example.com', db: harness.query })
    const [d1, d2] = await Promise.all([
      completeEmailMagicLink({ token: s1.echoToken!, db: harness.query }),
      completeEmailMagicLink({ token: s2.echoToken!, db: harness.query }),
    ])
    assert.equal(d1.webAccountId, d2.webAccountId)
    assert.equal(await verifiedAccountsFor(harness.query, 'race@example.com'), 1)
    assert.equal((await getWebAccountPremium(d1.webAccountId, harness.query)).isPremium, true)
    assert.deepEqual(await allEntitlements(harness.query), before)
  } finally {
    await harness.close()
  }
})

test('confirmation losing the unique-index race signs into the winner', async () => {
  const harness = await createHarness()
  try {
    const winner = await newAccount(harness.query)
    const loser = await newAccount(harness.query)
    const s = await startEmailBind({ webAccountId: loser, email: 'tie@example.com', db: harness.query })
    await verifyEmail(harness.query, winner, 'tie@example.com')
    // Simulate the other transaction committing between the owner check and the UPDATE.
    let hidden = false
    const racing: Queryable = {
      query: async (sql, params) => {
        if (!hidden && /email_verified_at IS NOT NULL/.test(sql) && /LIMIT 1/.test(sql)) {
          hidden = true
          return { rows: [] }
        }
        return harness.query.query(sql, params)
      },
    }
    const done = await completeEmailMagicLink({ token: s.echoToken!, db: racing })
    assert.equal(done.webAccountId, winner)
    assert.equal((await getWebAccountContact(loser, harness.query)).emailVerified, false)
    assert.equal(await verifiedAccountsFor(harness.query, 'tie@example.com'), 1)
  } finally {
    await harness.close()
  }
})

test('checkout opt-in ("save email") does not block restore on another device', async () => {
  const harness = await createHarness()
  try {
    const buyer = await newAccount(harness.query)
    const { paymentId } = await paidPurchase(harness.query, buyer, 'optin@example.com')
    await afterWebPurchasePaid({ webAccountId: buyer, paymentId, bindAccountEmail: true, db: harness.query })
    assert.equal((await getWebAccountContact(buyer, harness.query)).emailPending, true)

    const device = await newAccount(harness.query)
    const done = await confirmViaProfile(harness.query, device, 'optin@example.com')
    assert.equal(done.webAccountId, device)
    assert.equal((await getWebAccountPremium(device, harness.query)).isPremium, true)

    // The paying browser later confirms its pending address: it joins the same account.
    const fromBuyer = await startEmailBind({ webAccountId: buyer, email: 'optin@example.com', db: harness.query })
    assert.equal(await otpAccount(harness.query, fromBuyer.echoToken!), device)
    const joined = await completeEmailMagicLink({ token: fromBuyer.echoToken!, db: harness.query })
    assert.equal(joined.webAccountId, device)
    assert.equal(await verifiedAccountsFor(harness.query, 'optin@example.com'), 1)
  } finally {
    await harness.close()
  }
})

test("receipt purchases are not shared without mailbox proof or from another person's account", async () => {
  const harness = await createHarness()
  try {
    const guest = await newAccount(harness.query)
    await paidPurchase(harness.query, guest, 'shared@example.com')

    const pendingOnly = await newAccount(harness.query)
    await harness.query.query(
      `UPDATE web_accounts SET pending_email_normalized = 'shared@example.com' WHERE id = $1::uuid`,
      [pendingOnly]
    )
    assert.equal((await getWebAccountPremium(pendingOnly, harness.query)).isPremium, false, 'unverified contact')
    const legacyUnverified = await newAccount(harness.query)
    await harness.query.query(
      `UPDATE web_accounts SET email_normalized = 'shared@example.com' WHERE id = $1::uuid`,
      [legacyUnverified]
    )
    assert.equal(
      (await getWebAccountPremium(legacyUnverified, harness.query)).isPremium,
      false,
      'address stored without verification'
    )
    const typed = await newAccount(harness.query)
    await startEmailBind({ webAccountId: typed, email: 'shared@example.com', db: harness.query })
    assert.equal((await getWebAccountPremium(typed, harness.query)).isPremium, false, 'typed, not confirmed')

    const main = await newAccount(harness.query)
    await verifyEmail(harness.query, main, 'other@example.com')
    const someoneElse = await newAccount(harness.query)
    await verifyEmail(harness.query, someoneElse, 'someone@example.com')
    await paidPurchase(harness.query, someoneElse, 'other@example.com')
    assert.equal(
      (await getWebAccountPremium(main, harness.query)).isPremium,
      false,
      'a purchase made from an account with its own verified email stays there'
    )

    const unpaid = await newAccount(harness.query)
    await harness.query.query(
      `INSERT INTO web_payments (id, web_account_id, plan_id, amount_rub, status, receipt_email_normalized)
       VALUES ('pay_unpaid_1', $1::uuid, 'premium_web_1m', 259, 'pending', 'other@example.com')`,
      [unpaid]
    )
    assert.equal((await getWebAccountPremium(main, harness.query)).isPremium, false, 'pending payment')

    const expired = await newAccount(harness.query)
    await paidPurchase(harness.query, expired, 'other@example.com', { activeDays: -1 })
    const status = await getWebAccountPremium(main, harness.query)
    assert.equal(status.isPremium, false, 'expired purchase')
    assert.ok(status.lastEndedAt, 'but shows as ended Premium')
  } finally {
    await harness.close()
  }
})

test('purchase from a Telegram-linked guest is visible by email; the Telegram link itself is not moved', async () => {
  const harness = await createHarness()
  try {
    const tgGuest = await newAccount(harness.query)
    await paidPurchase(harness.query, tgGuest, 'tg@example.com')
    await harness.query.query(
      `INSERT INTO web_telegram_links (web_account_id, telegram_id) VALUES ($1::uuid, 4242)`,
      [tgGuest]
    )
    const device = await newAccount(harness.query)
    const done = await confirmViaProfile(harness.query, device, 'tg@example.com')
    assert.equal(done.webAccountId, device, 'the Telegram-linked account is not taken over')
    const premium = await getWebAccountPremium(device, harness.query)
    assert.deepEqual(premium.sources, ['web_purchase'])
    const links = await harness.query.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM web_telegram_links WHERE web_account_id = $1::uuid`,
      [device]
    )
    assert.equal(links.rows[0]!.c, '0')
  } finally {
    await harness.close()
  }
})

test('receipt email is offered as a prefill only to the paying guest account', async () => {
  const harness = await createHarness()
  try {
    const buyer = await newAccount(harness.query)
    await paidPurchase(harness.query, buyer, 'hint@example.com')
    const stranger = await newAccount(harness.query)
    assert.equal(await getOwnReceiptEmailHint(buyer, harness.query), 'hint@example.com')
    assert.equal(await getOwnReceiptEmailHint(stranger, harness.query), null)
    await confirmViaProfile(harness.query, buyer, 'hint@example.com')
    assert.equal(await getOwnReceiptEmailHint(buyer, harness.query), null)
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
    assert.notEqual(done.webAccountId, buyer)
    assert.equal((await getWebAccountPremium(done.webAccountId, harness.query)).isPremium, true)
    assert.equal(await countSessions(harness.query, buyer), 0)
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

test('profile save never moves the session into another guest account', async () => {
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

test('a sign-in link cannot overwrite a login email changed after it was sent', async () => {
  const harness = await createHarness()
  try {
    const owner = await newAccount(harness.query)
    await verifyEmail(harness.query, owner, 'late-claim@example.com')
    const started = await startEmailRecover({ email: 'late-claim@example.com', db: harness.query })
    assert.equal(await otpPurpose(harness.query, started.echoToken!), 'recover')
    await verifyEmail(harness.query, owner, 'real-owner@example.com')
    await assert.rejects(
      () => completeEmailMagicLink({ token: started.echoToken!, db: harness.query }),
      (err: Error & { code?: string }) => err.code === 'token_invalid'
    )
    assert.equal((await getWebAccountContact(owner, harness.query)).email, 'real-owner@example.com')
    assert.equal(await countSessions(harness.query, owner), 0)
  } finally {
    await harness.close()
  }
})

test('a sign-in link issued to a guest account by its receipt email (before this fix) no longer opens it', async () => {
  const harness = await createHarness()
  try {
    const buyer = await newAccount(harness.query)
    await paidPurchase(harness.query, buyer, 'stale@example.com')
    const contactBefore = await getWebAccountContact(buyer, harness.query)
    const token = `stale_recover_${'x'.repeat(32)}`
    await harness.query.query(
      `INSERT INTO web_email_otps (web_account_id, email_normalized, code_hash, purpose, expires_at)
       VALUES ($1::uuid, 'stale@example.com', $2, 'recover', now() + interval '30 minutes')`,
      [buyer, sha256Hex(token)]
    )
    await assert.rejects(
      () => completeEmailMagicLink({ token, db: harness.query }),
      (err: Error & { code?: string }) => err.code === 'token_invalid'
    )
    assert.equal(await countSessions(harness.query, buyer), 0)
    assert.deepEqual(await getWebAccountContact(buyer, harness.query), contactBefore)
  } finally {
    await harness.close()
  }
})

test("receipt email typed by mistake: B gets the Premium of that email, never guest account A's session", async () => {
  const harness = await createHarness()
  try {
    // A pays as a guest and types B's address for the receipt.
    const guestA = await newAccount(harness.query)
    const { paymentId, activeUntil } = await paidPurchase(harness.query, guestA, 'b-owner@example.com')
    const snapshotA = async () => ({
      account: (
        await harness.query.query(
          `SELECT email_normalized, email_verified_at, pending_email_normalized, revoked_at
             FROM web_accounts WHERE id = $1::uuid`,
          [guestA]
        )
      ).rows,
      payment: (
        await harness.query.query(
          `SELECT web_account_id::text AS acc, status, receipt_email_normalized, premium_granted_at
             FROM web_payments WHERE id = $1`,
          [paymentId]
        )
      ).rows,
      entitlements: (await allEntitlements(harness.query)).filter((e) => e.web_account_id === guestA),
      sessions: await countSessions(harness.query, guestA),
      contact: await getWebAccountContact(guestA, harness.query),
      premium: await getWebAccountPremium(guestA, harness.query),
    })
    const before = await snapshotA()
    const entitlementsBefore = await allEntitlements(harness.query)

    // B opens /login on their own device (no session) and confirms the mailbox.
    const started = await startEmailRecover({ email: 'b-owner@example.com', db: harness.query })
    assert.notEqual(await otpAccount(harness.query, started.echoToken!), guestA)
    const signedIn = await completeEmailMagicLink({ token: started.echoToken!, db: harness.query })
    const accountB = signedIn.webAccountId
    assert.notEqual(accountB, guestA, "B never receives a session of A's guest account")
    assert.equal(await countSessions(harness.query, accountB), 1)

    const premiumB = await getWebAccountPremium(accountB, harness.query)
    assert.equal(premiumB.isPremium, true, 'B sees the Premium paid with the confirmed email')
    assert.equal(premiumB.activeUntil, activeUntil.toISOString(), 'same term, not extended')

    // Account A and its purchase stay exactly as they were.
    assert.deepEqual(await snapshotA(), before)
    assert.deepEqual(await allEntitlements(harness.query), entitlementsBefore, 'nothing granted, moved or copied')

    // B signs in again later (another device, and with a stray guest session): same confirmed account.
    const again = await startEmailRecover({ email: 'b-owner@example.com', db: harness.query })
    assert.equal(await otpPurpose(harness.query, again.echoToken!), 'recover')
    const second = await completeEmailMagicLink({ token: again.echoToken!, db: harness.query })
    assert.equal(second.webAccountId, accountB)
    const strayGuest = await newAccount(harness.query)
    const third = await startEmailRecover({
      email: 'b-owner@example.com',
      callerAccountId: strayGuest,
      db: harness.query,
    })
    assert.equal(await otpAccount(harness.query, third.echoToken!), accountB)
    assert.equal(await verifiedAccountsFor(harness.query, 'b-owner@example.com'), 1)
    assert.deepEqual(await snapshotA(), before)
  } finally {
    await harness.close()
  }
})

test("/login from B's own guest session confirms the email for B's guest account, not for the payer", async () => {
  const harness = await createHarness()
  try {
    const guestA = await newAccount(harness.query)
    await paidPurchase(harness.query, guestA, 'c-owner@example.com')
    const guestB = await newAccount(harness.query)
    const started = await startEmailRecover({
      email: 'c-owner@example.com',
      callerAccountId: guestB,
      db: harness.query,
    })
    assert.equal(await otpPurpose(harness.query, started.echoToken!), 'bind')
    assert.equal(await otpAccount(harness.query, started.echoToken!), guestB)
    const done = await completeEmailMagicLink({ token: started.echoToken!, db: harness.query })
    assert.equal(done.webAccountId, guestB)
    assert.equal((await getWebAccountPremium(guestB, harness.query)).isPremium, true)
    assert.equal(await countSessions(harness.query, guestA), 0)

    // A caller already signed in with another verified email is not rebound from /login.
    const other = await newAccount(harness.query)
    await verifyEmail(harness.query, other, 'other@example.com')
    const fromOther = await startEmailRecover({
      email: 'fresh-login@example.com',
      callerAccountId: other,
      db: harness.query,
    })
    assert.notEqual(await otpAccount(harness.query, fromOther.echoToken!), other)
    assert.equal((await getWebAccountContact(other, harness.query)).email, 'other@example.com')
  } finally {
    await harness.close()
  }
})

// Saving a profile contact is NOT a login and cannot grant purchases made on another account.
test('profile contact saves without OTP and preserves current Premium only', async () => {
  const harness = await createHarness()
  try {
    const payer = await newAccount(harness.query)
    await paidPurchase(harness.query, payer, 'shared@example.com')
    const guest = await newAccount(harness.query)
    const answer = await saveProfileContactEmail({
      webAccountId: guest, email: 'SHARED@example.com', db: harness.query,
    })
    assert.equal(answer.mode, 'saved')
    const contact = await getWebAccountContact(guest, harness.query)
    assert.equal(contact.email, 'shared@example.com')
    assert.equal(contact.emailVerified, false)
    assert.equal((await getWebAccountPremium(guest, harness.query)).isPremium, false)
    const otps = await harness.query.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM web_email_otps WHERE web_account_id = $1::uuid',
      [guest]
    )
    assert.equal(otps.rows[0]!.count, '0')
    assert.equal((await getWebAccountPremium(payer, harness.query)).isPremium, true)
  } finally {
    await harness.close()
  }
})

test('profile contact on a paid guest keeps existing Premium without confirmation', async () => {
  const harness = await createHarness()
  try {
    const payer = await newAccount(harness.query)
    await paidPurchase(harness.query, payer, 'payer@example.com')
    const result = await saveProfileContactEmail({
      webAccountId: payer, email: 'payer@example.com', db: harness.query,
    })
    assert.equal(result.mode, 'saved')
    assert.equal((await getWebAccountPremium(payer, harness.query)).isPremium, true)
    const saved = await getWebAccountContact(payer, harness.query)
    assert.equal(saved.emailVerified, false)
    assert.equal(saved.email, 'payer@example.com')
  } finally {
    await harness.close()
  }
})


// Checkout without the legacy opt-in saves the receipt email automatically,
// but must not issue OTPs or authorize that mailbox as the paying account.
test('successful WEB checkout automatically saves email without a profile save step', async () => {
  const harness = await createHarness()
  try {
    const account = await newAccount(harness.query)
    const { paymentId } = await paidPurchase(harness.query, account, 'automatic@example.com')
    const saved = await afterWebPurchasePaid({
      webAccountId: account, paymentId, bindAccountEmail: false, db: harness.query,
    })
    assert.equal(saved.pendingEmail, 'automatic@example.com')
    assert.equal(saved.linkSent, false)
    const contact = await getWebAccountContact(account, harness.query)
    assert.equal(contact.email, 'automatic@example.com')
    assert.equal(contact.emailVerified, false, 'receipt email is not verified login identity')
    assert.equal((await getWebAccountPremium(account, harness.query)).isPremium, true)
    const tokenCount = await harness.query.query<{ c: string }>(
      'SELECT count(*)::text AS c FROM web_email_otps WHERE web_account_id = $1::uuid',
      [account]
    )
    assert.equal(tokenCount.rows[0]?.c, '0', 'checkout must not send login links')
  } finally {
    await harness.close()
  }
})
