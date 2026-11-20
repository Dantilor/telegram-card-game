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

test('entering known email restores existing account (and Premium stays there)', async () => {
  const harness = await createHarness()
  try {
    const a = await harness.query.query<{ id: string }>(
      `INSERT INTO web_accounts DEFAULT VALUES RETURNING id`
    )
    const b = await harness.query.query<{ id: string }>(
      `INSERT INTO web_accounts DEFAULT VALUES RETURNING id`
    )
    const accountA = String(a.rows[0]!.id)
    const accountB = String(b.rows[0]!.id)
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

    const restored = await startEmailBind({
      webAccountId: accountB,
      email: 'taken@example.com',
      db: harness.query,
    })
    assert.equal(restored.mode, 'restored')
    assert.equal(restored.webAccountId, accountA)
    assert.ok(restored.sessionToken)

    const premium = await getWebAccountPremium(accountA, harness.query)
    assert.equal(premium.isPremium, true)
  } finally {
    await harness.close()
  }
})

test('checkout opt-in pending enables recover; bare paid receipt does not; no duplicate Premium', async () => {
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
    assert.equal(bare.echoToken, undefined, 'receipt alone must not unlock recover')

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
    const bound = await startEmailBind({
      webAccountId,
      email: 'once@example.com',
      db: harness.query,
    })
    assert.equal(bound.echoToken, undefined)
    const started = await startEmailRecover({
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
