import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { diagnose, parseArgs, shortId, tag } from './diagnose-web-payment.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(here, '..')
const sql = (rel) => fs.readFileSync(path.join(serverRoot, rel), 'utf8')

async function freshDb() {
  const pg = new PGlite()
  for (const file of [
    'db/schema.sql',
    'db/migrations/001_payments_new_schema.sql',
    'db/migrations/002_plans_yookassa.sql',
    'db/staging/003_plans_three_tiers_fixed.sql',
    'db/migrations/004_payments_premium_granted_at.sql',
    'db/migrations/012_web_sessions.sql',
    'db/migrations/013_web_session_profile.sql',
    'db/migrations/017_web_anonymous_accounts.sql',
    'db/migrations/019_web_legal_subjects.sql',
    'db/migrations/020_web_email_magic_links.sql',
  ]) {
    await pg.exec(sql(file))
  }
  return pg
}

const PAYER = '11111111-1111-4111-8111-111111111111'
const LATER = '22222222-2222-4222-8222-222222222222'
const PAYMENT = '30a1b2c3-000f-5000-9000-1539987abcde'
const UA = 'a'.repeat(64)

async function seedGrantedPayment(pg) {
  await pg.query(`INSERT INTO web_accounts (id, created_at) VALUES ($1, now() - interval '1 hour')`, [PAYER])
  await pg.query(
    `INSERT INTO web_sessions (token_hash, csrf_hash, web_account_id, expires_at, user_agent_hash)
     VALUES ($1, $2, $3, now() + interval '30 days', $4)`,
    ['1'.repeat(64), '2'.repeat(64), PAYER, UA]
  )
  await pg.query(
    `INSERT INTO web_payments (id, web_account_id, plan_id, amount_rub, status, created_at, paid_at,
                               premium_granted_at, receipt_email_normalized)
     VALUES ($1, $2, 'premium_web_1m', 259, 'succeeded', now() - interval '20 minutes',
             now() - interval '15 minutes', now() - interval '15 minutes', 'buyer@example.test')`,
    [PAYMENT, PAYER]
  )
  await pg.query(
    `INSERT INTO web_entitlements (web_account_id, plan_id, source, active_until, payment_id)
     VALUES ($1, 'premium_web_1m', 'web_purchase', now() + interval '30 days', $2)`,
    [PAYER, PAYMENT]
  )
}

test('masks identifiers and validates the payment id', () => {
  assert.equal(shortId(PAYMENT), '30a1b2c3…')
  assert.match(tag(PAYER), /^#[0-9a-f]{8}$/)
  assert.throws(() => parseArgs([]), /Usage/)
  assert.throws(() => parseArgs(['--payment-id', "x'; DROP TABLE web_payments;--"]), /Usage/)
  assert.deepEqual(parseArgs(['--payment-id', PAYMENT]), { paymentId: PAYMENT })
})

test('granted payment, browser still on the paying account', async () => {
  const pg = await freshDb()
  await seedGrantedPayment(pg)
  const out = await diagnose(pg, PAYMENT)

  assert.equal(out.verdict, 'GRANTED_OK__CHECK_CLIENT_SESSION')
  assert.equal(out.webPayment.status, 'succeeded')
  assert.equal(out.webPayment.amountRub, 259)
  assert.equal(out.webPayment.planId, 'premium_web_1m')
  assert.equal(out.entitlementsForPayment.count, 1)
  assert.equal(out.entitlementsForPayment.allOnPayingAccount, true)
  assert.equal(out.payingAccountEntitlements[0].forThisPayment, true)
  assert.equal(out.payingAccountEntitlements[0].activeNow, true)
  assert.equal(out.telegramPaymentsRows, 0)

  const text = JSON.stringify(out)
  assert.ok(!text.includes(PAYER), 'full account id must not be printed')
  assert.ok(!text.includes(PAYMENT), 'full payment id must not be printed')
  assert.ok(!text.includes('buyer@example.test'), 'email must not be printed')
})

test('flags a new anonymous account created on the same browser after the payment', async () => {
  const pg = await freshDb()
  await seedGrantedPayment(pg)
  await pg.query(`INSERT INTO web_accounts (id, created_at) VALUES ($1, now() - interval '10 minutes')`, [LATER])
  await pg.query(
    `INSERT INTO web_sessions (token_hash, csrf_hash, web_account_id, expires_at, user_agent_hash)
     VALUES ($1, $2, $3, now() + interval '30 days', $4)`,
    ['3'.repeat(64), '4'.repeat(64), LATER, UA]
  )
  const out = await diagnose(pg, PAYMENT)

  assert.equal(out.verdict, 'GRANTED_OK__BROWSER_LIKELY_ON_NEW_ACCOUNT')
  assert.equal(out.accountsCreatedAfterPayment.sameUserAgentAsPayer.length, 1)
  assert.equal(out.accountsCreatedAfterPayment.sameUserAgentAsPayer[0].account, tag(LATER))
  assert.equal(out.accountsCreatedAfterPayment.sameUserAgentAsPayer[0].hasActiveEntitlement, false)
})

test('reports a missing or ungranted payment without inventing a grant', async () => {
  const pg = await freshDb()
  const missing = await diagnose(pg, PAYMENT)
  assert.equal(missing.verdict, 'NO_WEB_PAYMENT_ROW')

  await pg.query(`INSERT INTO web_accounts (id) VALUES ($1)`, [PAYER])
  await pg.query(
    `INSERT INTO web_payments (id, web_account_id, plan_id, amount_rub, status)
     VALUES ($1, $2, 'premium_web_1m', 259, 'pending')`,
    [PAYMENT, PAYER]
  )
  const pending = await diagnose(pg, PAYMENT)
  assert.equal(pending.verdict, 'NOT_GRANTED_IN_DB')
  assert.equal(pending.entitlementsForPayment.count, 0)
})