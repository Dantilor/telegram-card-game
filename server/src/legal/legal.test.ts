import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import express from 'express'
import { PGlite } from '@electric-sql/pglite'
import { assessAnalyticsEvent, handleAnalyticsEvent } from './analytics.js'
import { assertCheckout, customerForNewYookassaReceipt, parseReceiptContact } from './checkout.js'
import { LegalError } from './errors.js'
import { STATEMENTS, DOCUMENT_CATALOG, type DocumentId } from './constants.js'
import { deleteExpiredAnalytics } from './cleanup.js'
import {
  acceptOffer,
  declineConsent,
  grantConsent,
  hasActiveAnalyticsConsent,
  registerAccount,
  withdrawConsent,
} from './consents.js'
import { activateDocuments, deactivateDocuments, importDocuments, readActiveDocument, readStoredVersion } from './documents.js'
import { renderDocumentHtml, renderUnavailableHtml } from './html.js'
import { sha256Utf8 } from './hash.js'
import { enqueueMarketing, deliverMarketingQueueItem } from './marketing.js'
import { loadLegalPackage } from './packageFile.js'
import { CLAIM_PREMIUM_GRANT_SQL } from '../payments/premiumGrantSql.js'
import { createLegalHtmlRouter, createLegalRouter } from '../routes/legal.js'
import { verifyInitData } from '../telegram/verifyInitData.js'
import type { LegalPlan, ParsedDocument, Queryable, TransactionRunner } from './types.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(here, '../..')
const repoRoot = path.resolve(serverRoot, '..')
const BOT_TOKEN = '123456:TEST'

function readSql(relativePath: string): string {
  return fs.readFileSync(path.join(serverRoot, relativePath), 'utf8')
}

function fiction(id: DocumentId, version = '2026-10-20.1', body?: string): ParsedDocument {
  const text = body ?? `FICTIONAL ${id} ${version} NOT AN APPROVED LEGAL DOCUMENT\n`
  const catalog = DOCUMENT_CATALOG[id]
  return {
    id,
    version,
    title: `Fiction ${id}`,
    kind: catalog.kind,
    scope: catalog.scope,
    documentDate: '2026-10-20',
    sha256: sha256Utf8(text),
    bodyMarkdown: text,
    blocks: [{ type: 'paragraph', text: text.trim() }],
    requiresIndividualDetails: catalog.individual,
  }
}

type Harness = {
  query: Queryable
  withTransaction: TransactionRunner
  close: () => Promise<void>
}

async function createHarness(): Promise<Harness> {
  const pg = new PGlite()
  await pg.exec(readSql('db/schema.sql'))
  await pg.exec(readSql('db/migrations/002_plans_yookassa.sql'))
  await pg.exec(`
    ALTER TABLE plans ADD COLUMN IF NOT EXISTS plan_id TEXT;
    UPDATE plans SET plan_id = id WHERE plan_id IS NULL;
    INSERT INTO plans (id, plan_id, title, price_rub, duration_days, is_active)
    VALUES
      ('premium_1m', 'premium_1m', 'Premium 1m', 259, 30, true),
      ('premium_3m', 'premium_3m', 'Premium 3m', 399, 90, true),
      ('premium_lifetime', 'premium_lifetime', 'Premium lifetime', 990, 36500, true)
    ON CONFLICT (id) DO UPDATE SET
      plan_id = EXCLUDED.plan_id,
      title = EXCLUDED.title,
      price_rub = EXCLUDED.price_rub,
      duration_days = EXCLUDED.duration_days,
      is_active = EXCLUDED.is_active;
  `)
  await pg.exec(readSql('db/migrations/004_payments_premium_granted_at.sql'))
  await pg.exec(readSql('db/migrations/005_legal_documents.sql'))
  const wrap = (target: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> }): Queryable => ({
    query: async (sql, params) => {
      const result = await target.query(sql, params)
      return { rows: result.rows as Record<string, unknown>[] }
    },
  })
  return {
    query: wrap(pg),
    withTransaction: (fn) => pg.transaction(async (tx) => fn(wrap(tx))),
    close: () => pg.close(),
  }
}

function signInitData(userId: number): string {
  const authDate = Math.floor(Date.now() / 1000)
  const user = JSON.stringify({ id: userId, first_name: 'Test' })
  const dataCheckString = [`auth_date=${authDate}`, `user=${user}`].sort().join('\n')
  const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest()
  const hash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex')
  return `auth_date=${authDate}&user=${encodeURIComponent(user)}&hash=${hash}`
}

async function withServer(app: express.Express, fn: (baseUrl: string) => Promise<void>): Promise<void> {
  const server = http.createServer(app)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  try {
    await fn(`http://127.0.0.1:${port}`)
  } finally {
    server.close()
    await once(server, 'close')
  }
}

async function rejectsCode(fn: () => Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(fn, (error: unknown) => {
    assert.ok(error instanceof LegalError)
    assert.equal(error.code, code)
    return true
  })
}

const PLAN: LegalPlan = { planId: 'premium_1m', title: 'Premium 1m', priceRub: 259, durationDays: 30 }

test('analytics allowlist rejects free text, secrets, and unknown events', () => {
  assert.throws(() => assessAnalyticsEvent('note', { text: 'hello' }), /не входит/)
  assert.throws(() => assessAnalyticsEvent('app_open', { initData: 'secret' }), /не разрешено/)
  assert.deepEqual(assessAnalyticsEvent('start_game', { gameId: 'truth-dare' }), {
    name: 'start_game',
    props: { gameId: 'truth-dare' },
  })
})

test('invalid initData is not stored as an anonymous event', async () => {
  let calls = 0
  const result = await handleAnalyticsEvent({
    query: {
      query: async () => {
        calls += 1
        throw new Error('query should not run')
      },
    },
    botToken: BOT_TOKEN,
    initData: 'auth_date=1&hash=deadbeef',
    name: 'app_open',
    props: null,
  })
  assert.equal(result.status, 401)
  assert.equal(calls, 0)
})

test('placeholder receipt contact is rejected', () => {
  assert.throws(() => parseReceiptContact('100@gamenight.local', null), /Технический адрес/)
  assert.throws(() => parseReceiptContact('', ''), /укажите/i)
  assert.equal(parseReceiptContact('  buyer@example.com  ', '   ').stored, 'buyer@example.com')
  assert.equal(parseReceiptContact('  buyer@example.com  ', '   ').kind, 'email')
})

test('new yookassa receipt is email only and a phone does not reach the provider', async () => {
  let providerCalls = 0
  const provider = async (customer: { email: string }) => {
    providerCalls += 1
    assert.equal(Object.hasOwn(customer, 'phone'), false)
    return customer
  }
  const created = await provider(customerForNewYookassaReceipt('  buyer@example.com  ', '   '))
  assert.deepEqual(created, { email: 'buyer@example.com' })
  for (const input of [
    ['buyer@example.com', '+79991234567'],
    [null, '79991234567'],
    ['   ', null],
    ['not-an-email', null],
  ] as const) {
    await assert.rejects(
      async () => {
        await provider(customerForNewYookassaReceipt(input[0], input[1]))
      },
      (error: unknown) => {
        assert.ok(error instanceof LegalError)
        assert.equal(error.status, 400)
        return true
      }
    )
  }
  assert.equal(providerCalls, 1)
  const route = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../routes/yookassa.ts'), 'utf8')
  const guard = route.indexOf('customerForNewYookassaReceipt(req.body')
  const providerCall = route.indexOf('https://api.yookassa.ru/v3/payments')
  const paymentInsert = route.indexOf('query(INSERT_CHECKOUT_PAYMENT_SQL')
  assert.ok(guard !== -1 && providerCall !== -1 && paymentInsert !== -1)
  assert.ok(guard < providerCall && providerCall < paymentInsert)
  assert.equal(route.includes('customer.phone'), false)
  assert.equal(route.includes('customerPhone'), false)
})

test('html escapes document text and does not invent a policy', () => {
  const document = fiction('privacy', '2026-10-20.1', 'FICTIONAL <script>alert(1)</script>\n')
  const html = renderDocumentHtml({
    versionId: 1,
    id: document.id,
    version: document.version,
    title: document.title,
    kind: document.kind,
    scope: document.scope,
    documentDate: null,
    sha256: document.sha256,
    bodyMarkdown: document.bodyMarkdown,
    blocks: document.blocks,
    requiresIndividualDetails: false,
    active: true,
    activatedAt: null,
  })
  assert.equal(html.includes('<script>'), false)
  assert.equal(html.includes('&lt;script&gt;'), true)
  assert.match(html, /Content-Security-Policy/)
  assert.match(renderUnavailableHtml(), /не заменяет документ/)
})

test('document storage, consent races, analytics, marketing, and paid orders', async () => {
  const harness = await createHarness()
  try {
    const offer = fiction('offer')
    const privacy = fiction('privacy', '2026-10-20.1', 'FICTIONAL privacy <script>alert(1)</script>\n')
    const agreement = fiction('agreement')
    const pd = fiction('pd_account')
    const analytics = fiction('analytics')
    const permission = fiction('marketing_permission')
    const marketingPd = fiction('marketing_pd')
    const review = fiction('review_publication')
    await importDocuments(harness.withTransaction, [offer, privacy, agreement, pd, analytics, permission, marketingPd, review])
    const activations = await harness.query.query('SELECT id FROM legal_document_activations')
    assert.equal(activations.rows.length, 0)
    const evidenceBefore = await harness.query.query('SELECT id FROM legal_evidence')
    assert.equal(evidenceBefore.rows.length, 0)

    const changedOffer = fiction('offer', offer.version, `${offer.bodyMarkdown}CHANGED`)
    await rejectsCode(
      () => importDocuments(harness.withTransaction, [changedOffer, fiction('image_permission')]),
      'document_version_conflict'
    )
    const imageRows = await harness.query.query(
      `SELECT id FROM legal_document_versions WHERE document_id = 'image_permission'`
    )
    assert.equal(imageRows.rows.length, 0)

    await importDocuments(harness.withTransaction, [offer])
    const offerCount = await harness.query.query(
      `SELECT COUNT(*)::int AS count FROM legal_document_versions WHERE document_id = 'offer'`
    )
    assert.equal(Number(offerCount.rows[0]?.count), 1)

    const privacyNext = fiction('privacy', '2026-11-01.1', 'FICTIONAL privacy SECOND VERSION\n')
    await importDocuments(harness.withTransaction, [privacyNext])
    await activateDocuments(harness.withTransaction, [privacy, agreement, offer, pd, analytics, permission, marketingPd])
    await activateDocuments(harness.withTransaction, [privacyNext])
    const unpublished = fiction('privacy', '2026-12-01.1', 'FICTIONAL privacy NEVER PUBLISHED\n')
    await importDocuments(harness.withTransaction, [unpublished])
    const archived = await readStoredVersion(harness.query, 'privacy', privacy.version)
    assert.equal(archived?.bodyMarkdown, privacy.bodyMarkdown)
    assert.equal(archived?.active, false)
    const activePrivacy = await readActiveDocument(harness.query, 'privacy')
    assert.equal(activePrivacy?.version, privacyNext.version)
    await assert.rejects(() => harness.query.query('DELETE FROM legal_document_versions'), /cannot be deleted/)

    const initData = signInitData(7)
    assert.equal(verifyInitData(initData, BOT_TOKEN).telegram_id, 7)
    const app = express()
    app.use(express.json())
    const deps = {
      query: harness.query,
      withTransaction: harness.withTransaction,
      verifyInitData,
      getBotToken: () => BOT_TOKEN,
      getPlan: async (planId: string) => (planId === PLAN.planId ? PLAN : null),
    }
    app.use('/api/legal', createLegalRouter(deps))
    app.use('/legal', createLegalHtmlRouter({ query: harness.query }))

    await withServer(app, async (baseUrl) => {
      const before = await harness.query.query('SELECT COUNT(*)::int AS count FROM users')
      const listed = await fetch(`${baseUrl}/api/legal/documents`)
      assert.equal(listed.status, 200)
      const listBody = (await listed.json()) as { documents: Array<Record<string, unknown>> }
      assert.equal(Object.hasOwn(listBody.documents[0] ?? {}, 'bodyMarkdown'), false)
      const privacyResponse = await fetch(`${baseUrl}/api/legal/documents/privacy`)
      const privacyJson = (await privacyResponse.json()) as {
        bodyMarkdown: string
        sha256: string
        version: string
        versions: Array<{ version: string }>
      }
      assert.equal(privacyJson.bodyMarkdown, privacyNext.bodyMarkdown)
      assert.equal(privacyJson.sha256, privacyNext.sha256)
      assert.equal(privacyJson.versions.some((item) => item.version === unpublished.version), false)
      const oldResponse = await fetch(`${baseUrl}/api/legal/documents/privacy/versions/${privacy.version}`)
      const oldJson = (await oldResponse.json()) as { bodyMarkdown: string; active: boolean }
      assert.equal(oldResponse.status, 200)
      assert.equal(oldJson.bodyMarkdown, privacy.bodyMarkdown)
      assert.equal(oldJson.active, false)
      const draftResponse = await fetch(`${baseUrl}/api/legal/documents/privacy/versions/${unpublished.version}`)
      assert.equal(draftResponse.status, 404)
      const draftHtml = await fetch(`${baseUrl}/legal/documents/privacy/versions/${unpublished.version}`)
      assert.equal(draftHtml.status, 404)
      const reviewResponse = await fetch(`${baseUrl}/api/legal/documents/review_publication`)
      assert.equal(reviewResponse.status, 404)
      const reviewHtml = await fetch(`${baseUrl}/legal/documents/review_publication/versions/${review.version}`)
      assert.equal(reviewHtml.status, 404)
      const html = await fetch(`${baseUrl}/legal/documents/privacy/versions/${privacy.version}`)
      const htmlText = await html.text()
      assert.equal(htmlText.includes('<script>'), false)
      assert.equal(htmlText.includes('&lt;script&gt;'), true)
      const missing = await fetch(`${baseUrl}/api/legal/documents/not_a_document`)
      assert.equal(missing.status, 404)
      const missingBody = (await missing.json()) as { message: string }
      assert.match(missingBody.message, /недоступен/)
      assert.equal(missingBody.message.includes('FICTIONAL'), false)
      const after = await harness.query.query('SELECT COUNT(*)::int AS count FROM users')
      assert.equal(Number(before.rows[0]?.count), Number(after.rows[0]?.count))

      const spoof = await fetch(`${baseUrl}/api/legal/consents`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-telegram-init-data': initData },
        body: JSON.stringify({
          documentId: 'analytics',
          requestId: 'analytics-grant-7',
          statement: STATEMENTS.analytics,
          telegramId: 999,
          version: '1999-01-01.1',
        }),
      })
      assert.equal(spoof.status, 409)
      const noEvidence = await harness.query.query('SELECT id FROM legal_evidence')
      assert.equal(noEvidence.rows.length, 0)

      const granted = await fetch(`${baseUrl}/api/legal/consents`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-telegram-init-data': initData },
        body: JSON.stringify({
          documentId: 'analytics',
          requestId: 'analytics-grant-7',
          statement: STATEMENTS.analytics,
          telegramId: 999,
          version: analytics.version,
          sha256: analytics.sha256,
        }),
      })
      assert.equal(granted.status, 201)
      const storedGrant = await harness.query.query<{ document_version: string; document_sha256: string }>(
        `SELECT document_version, document_sha256 FROM legal_evidence WHERE request_id = 'analytics-grant-7'`
      )
      assert.equal(storedGrant.rows[0]?.document_version, analytics.version)
      assert.equal(storedGrant.rows[0]?.document_sha256, analytics.sha256)
      const owner = await harness.query.query<{ subject_telegram_id: string | number }>(
        'SELECT subject_telegram_id FROM legal_evidence'
      )
      assert.equal(String(owner.rows[0]?.subject_telegram_id), '7')
      const stranger = await harness.query.query(`SELECT 1 FROM users WHERE telegram_id = 999`)
      assert.equal(stranger.rows.length, 0)
    })

    const replayWithdraw = await withdrawConsent(harness.withTransaction, 7, {
      documentId: 'analytics',
      requestId: 'analytics-withdraw-7',
    })
    assert.equal(replayWithdraw.active, false)
    const replay = await grantConsent(harness.withTransaction, 7, {
      documentId: 'analytics',
      requestId: 'analytics-grant-7',
      statement: STATEMENTS.analytics,
    })
    assert.equal(replay.idempotent, true)
    assert.equal(replay.active, false)
    await rejectsCode(
      () =>
        grantConsent(harness.withTransaction, 7, {
          documentId: 'analytics',
          requestId: 'analytics-grant-7b',
          statement: STATEMENTS.analytics,
          version: analytics.version,
          sha256: analytics.sha256,
        }),
      'consent_withdrawn'
    )
    const restored = await grantConsent(harness.withTransaction, 7, {
      documentId: 'analytics',
      requestId: 'analytics-grant-7c',
      statement: STATEMENTS.analytics,
      version: analytics.version,
      sha256: analytics.sha256,
      reconfirm: true,
    })
    assert.equal(restored.active, true)
    await harness.query.query(
      `UPDATE legal_preferences SET valid_until = now() - interval '1 day' WHERE subject_telegram_id = 7 AND document_id = 'analytics'`
    )
    assert.equal(await hasActiveAnalyticsConsent(harness.query, 7), false)
    const expiredEvent = await handleAnalyticsEvent({
      query: harness.query,
      botToken: BOT_TOKEN,
      initData,
      name: 'app_open',
      props: null,
    })
    assert.equal(expiredEvent.status, 403)
    const eventsAfterExpiry = await harness.query.query('SELECT id FROM events')
    assert.equal(eventsAfterExpiry.rows.length, 0)

    await harness.query.query(
      `UPDATE legal_preferences SET valid_until = now() + interval '1 day' WHERE subject_telegram_id = 7 AND document_id = 'analytics'`
    )
    const storedEvent = await handleAnalyticsEvent({
      query: harness.query,
      botToken: BOT_TOKEN,
      initData,
      name: 'open_deck',
      props: { deckId: 'aboutUs', secret: 'nope' },
    })
    assert.equal(storedEvent.status, 400)
    const allowedEvent = await handleAnalyticsEvent({
      query: harness.query,
      botToken: BOT_TOKEN,
      initData,
      name: 'open_deck',
      props: { deckId: 'aboutUs' },
    })
    assert.equal(allowedEvent.status, 200)
    const stored = await harness.query.query<{ telegram_id: string | number; event_props: { deckId?: string } }>(
      'SELECT telegram_id, event_props FROM events'
    )
    assert.equal(String(stored.rows[0]?.telegram_id), '7')
    assert.equal(stored.rows[0]?.event_props.deckId, 'aboutUs')

    await rejectsCode(
      () =>
        grantConsent(harness.withTransaction, 7, {
          documentId: 'review_publication',
          requestId: 'review-7',
          statement: 'any',
        }),
      'individual_permission_not_collected'
    )
    await rejectsCode(
      () =>
        grantConsent(harness.withTransaction, 7, {
          documentId: 'marketing_permission',
          requestId: 'email-channel',
          statement: STATEMENTS.marketing_permission,
          channel: 'email',
        }),
      'email_channel_unavailable'
    )

    for (const userId of [11, 12]) {
      await grantConsent(harness.withTransaction, userId, {
        documentId: 'marketing_permission',
        requestId: `perm-user-${userId}`,
        statement: STATEMENTS.marketing_permission,
        channel: 'telegram',
        version: permission.version,
        sha256: permission.sha256,
      })
      await grantConsent(harness.withTransaction, userId, {
        documentId: 'marketing_pd',
        requestId: `pd-market-${userId}`,
        statement: STATEMENTS.marketing_pd,
        channel: 'telegram',
        version: marketingPd.version,
        sha256: marketingPd.sha256,
      })
    }
    const queued = await enqueueMarketing(harness.withTransaction, {
      channel: 'telegram',
      limit: 10,
      offset: 0,
      createdAfter: null,
      onlyTelegramId: null,
      message: { kind: 'text', text: 'fiction promo' },
    })
    assert.equal(queued.totalSelected, 2)
    await withdrawConsent(harness.withTransaction, 12, {
      documentId: 'marketing_permission',
      requestId: 'withdraw-perm-12',
      channel: 'telegram',
    })
    const sent: number[] = []
    for (const item of queued.queue) {
      const outcome = await deliverMarketingQueueItem(harness, {
        queueId: item.id,
        channel: 'telegram',
        send: async (telegramId) => {
          sent.push(telegramId)
        },
      })
      if (item.telegramId === 12) assert.equal(outcome, 'skipped')
    }
    assert.deepEqual(sent, [11])
    const cancelled = await harness.query.query<{ status: string }>(
      `SELECT status FROM marketing_queue WHERE subject_telegram_id = 12`
    )
    assert.equal(cancelled.rows[0]?.status, 'cancelled')

    await rejectsCode(
      () =>
        registerAccount(harness.withTransaction, 78, {
          agreementRequestId: 'agreement-78',
          accepted: true,
          version: agreement.version,
          sha256: agreement.sha256,
          pdAccount: { action: 'grant', requestId: 'pd-78', statement: 'not the prescribed phrase' },
        }),
      'statement_mismatch'
    )
    const rolledBack = await harness.query.query(`SELECT 1 FROM users WHERE telegram_id = 78`)
    assert.equal(rolledBack.rows.length, 0)
    await harness.query.query(`INSERT INTO users (telegram_id) VALUES (77)`)
    await rejectsCode(
      () =>
        registerAccount(harness.withTransaction, 77, {
          agreementRequestId: 'agreement-77',
          accepted: true,
          version: agreement.version,
          sha256: agreement.sha256,
          pdAccount: { action: 'grant', requestId: 'pd-77', statement: 'not the prescribed phrase' },
        }),
      'statement_mismatch'
    )
    const kept = await harness.query.query(`SELECT 1 FROM users WHERE telegram_id = 77`)
    const keptEvidence = await harness.query.query(`SELECT 1 FROM legal_evidence WHERE subject_telegram_id = 77`)
    assert.equal(kept.rows.length, 1)
    assert.equal(keptEvidence.rows.length, 0)

    const registered = await registerAccount(harness.withTransaction, 79, {
      agreementRequestId: 'agreement-79',
      accepted: true,
      version: agreement.version,
      sha256: agreement.sha256,
    })
    assert.equal(registered.agreement.active, true)
    assert.equal(registered.pdAccount, null)
    const acceptance = await acceptOffer(harness.withTransaction, 79, {
      requestId: 'offer-79',
      statement: STATEMENTS.offer,
      plan: PLAN,
      priceRub: 259,
      currency: 'RUB',
      durationDays: 30,
      version: offer.version,
      sha256: offer.sha256,
    })
    const checkout = await assertCheckout(harness.query, {
      telegramId: 79,
      plan: PLAN,
      offerAcceptanceId: acceptance.evidenceId,
      email: 'buyer@example.com',
      phone: null,
    })
    assert.equal(checkout.contact.stored, 'buyer@example.com')
    await assert.rejects(
      () =>
        assertCheckout(harness.query, {
          telegramId: 79,
          plan: PLAN,
          offerAcceptanceId: acceptance.evidenceId,
          email: '79@gamenight.local',
          phone: null,
        }),
      (error: unknown) => {
        assert.ok(error instanceof LegalError)
        assert.equal(error.code, 'receipt_contact_invalid')
        return true
      }
    )
    await assert.rejects(
      () =>
        assertCheckout(harness.query, {
          telegramId: 80,
          plan: PLAN,
          offerAcceptanceId: acceptance.evidenceId,
          email: 'buyer@example.com',
          phone: null,
        }),
      (error: unknown) => {
        assert.ok(error instanceof LegalError)
        assert.equal(error.code, 'offer_acceptance_not_found')
        return true
      }
    )
    const marketingForBuyer = await harness.query.query(
      `SELECT 1 FROM legal_preferences WHERE subject_telegram_id = 79 AND document_id LIKE 'marketing%'`
    )
    assert.equal(marketingForBuyer.rows.length, 0)

    await declineConsent(harness.withTransaction, 79, { documentId: 'analytics', requestId: 'decline-analytics-79' })
    assert.equal(await hasActiveAnalyticsConsent(harness.query, 79), false)

    await harness.query.query(
      `INSERT INTO payments (
         telegram_id, provider, plan_id, provider_payment_charge_id, status, currency, total_amount
       ) VALUES (79, 'yookassa', 'premium_1m', 'pay-old', 'pending', 'RUB', 259)`
    )
    const claimed = await harness.query.query<{ premium_granted_at: Date | string | null }>(CLAIM_PREMIUM_GRANT_SQL, [
      'pay-old',
    ])
    assert.ok(claimed.rows[0]?.premium_granted_at)
    const secondClaim = await harness.query.query(CLAIM_PREMIUM_GRANT_SQL, ['pay-old'])
    assert.equal(secondClaim.rows.length, 0)

    await harness.query.query(
      `INSERT INTO events (telegram_id, event_name, created_at) VALUES (7, 'app_open', now() - interval '120 days')`
    )
    await harness.query.query(
      `INSERT INTO legal_evidence (
         subject_telegram_id, action, document_id, document_version, document_sha256, context,
         confirmation_source, request_id, created_at
       ) VALUES (
         7, 'decline', 'analytics', $1, $2, '{}'::jsonb, 'telegram_webapp', 'old-evidence', now() - interval '400 days'
       )`,
      [analytics.version, analytics.sha256]
    )
    const deleted = await deleteExpiredAnalytics(harness.query)
    assert.ok(deleted >= 1)
    const oldEvent = await harness.query.query(
      `SELECT id FROM events WHERE created_at < now() - interval '100 days'`
    )
    const oldEvidence = await harness.query.query(
      `SELECT id FROM legal_evidence WHERE request_id = 'old-evidence'`
    )
    assert.equal(oldEvent.rows.length, 0)
    assert.equal(oldEvidence.rows.length, 1)
  } finally {
    await harness.close()
  }
})

test('deactivation hides the active pointer and keeps the archive', async () => {
  const harness = await createHarness()
  try {
    const privacy = fiction('privacy')
    await importDocuments(harness.withTransaction, [privacy])
    await activateDocuments(harness.withTransaction, [privacy])
    await harness.query.query(`INSERT INTO users (telegram_id) VALUES (5)`)
    const hidden = await deactivateDocuments(harness.withTransaction, ['privacy'])
    assert.deepEqual(hidden.deactivated, [`privacy@${privacy.version}`])
    assert.equal(await readActiveDocument(harness.query, 'privacy'), null)
    const stored = await readStoredVersion(harness.query, 'privacy', privacy.version)
    assert.equal(stored?.bodyMarkdown, privacy.bodyMarkdown)
    const users = await harness.query.query(`SELECT telegram_id FROM users`)
    assert.equal(users.rows.length, 1)
    await assert.rejects(
      () => harness.query.query(`DELETE FROM legal_document_versions WHERE document_id = 'privacy'`),
      /cannot be deleted/
    )
  } finally {
    await harness.close()
  }
})

test('server sources do not embed the private legal package', () => {
  const packagePath = path.join(repoRoot, '_private_legal_import', 'documents.json')
  if (!fs.existsSync(packagePath)) return
  const loaded = loadLegalPackage(packagePath)
  assert.equal(loaded.documents.length, 10)
  const files: string[] = []
  const walk = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '_private_legal_import') continue
      const fullPath = path.join(directory, entry.name)
      if (entry.isDirectory()) walk(fullPath)
      else if (/\.(ts|js|sql|json|md|html)$/.test(entry.name)) files.push(fullPath)
    }
  }
  walk(path.join(serverRoot, 'src'))
  walk(path.join(serverRoot, 'db'))
  const blob = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n')
  for (const document of loaded.documents) {
    assert.equal(blob.includes(document.sha256), false, document.id)
    assert.equal(blob.includes(document.bodyMarkdown.slice(0, 120)), false, document.id)
  }
  const main = fs.readFileSync(path.join(serverRoot, 'src/main.ts'), 'utf8')
  assert.equal(main.includes('importDocuments'), false)
  assert.equal(main.includes('legal/cli'), false)
  const yookassa = fs.readFileSync(path.join(serverRoot, 'src/routes/yookassa.ts'), 'utf8')
  const grant = yookassa.slice(
    yookassa.indexOf('async function grantPremiumByPaymentId'),
    yookassa.indexOf('async function handleWebhook')
  )
  const webhook = yookassa.slice(
    yookassa.indexOf('async function handleWebhook'),
    yookassa.indexOf('async function handleConfirm')
  )
  assert.equal(grant.includes('assertCheckout'), false)
  assert.equal(webhook.includes('assertCheckout'), false)
  assert.equal(yookassa.includes('gamenight.local'), false)
  const admin = fs.readFileSync(path.join(serverRoot, 'src/routes/admin.ts'), 'utf8')
  assert.equal(admin.includes("if (req.body?.service"), false)
  assert.ok((admin.match(/sendConsentedMarketing/g) ?? []).length >= 5)
})

test('import dry-run does not contact a database', async () => {
  const packagePath = path.join(repoRoot, '_private_legal_import', 'documents.json')
  if (!fs.existsSync(packagePath)) return
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', path.join(serverRoot, 'src/legal/cli.ts'), 'import', '--file', packagePath],
    {
      cwd: serverRoot,
      env: { ...process.env, DATABASE_URL: 'postgres://nope:nope@127.0.0.1:1/none' },
    }
  )
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk: Buffer) => {
    stdout += chunk.toString('utf8')
  })
  child.stderr.on('data', (chunk: Buffer) => {
    stderr += chunk.toString('utf8')
  })
  const code: number = await new Promise((resolve, reject) => {
    child.on('error', reject)
    child.on('close', (exitCode) => resolve(exitCode ?? 1))
  })
  assert.equal(code, 0, stderr)
  assert.match(stdout, /database: not contacted/)
  assert.equal(`${stdout}\n${stderr}`.includes('[DB]'), false)
  const raw = JSON.parse(fs.readFileSync(packagePath, 'utf8')) as { documents: Array<{ body_markdown: string }> }
  assert.equal(stdout.includes(raw.documents[0]?.body_markdown.slice(0, 80) ?? 'missing'), false)
})
