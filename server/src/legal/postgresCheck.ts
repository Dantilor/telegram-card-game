/**
 * Isolated PostgreSQL check. Refuses any host other than loopback.
 * Run only with GNH_TEST_DATABASE_URL pointing at a disposable local database.
 * This file is not part of `npm test`.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { DOCUMENT_CATALOG, STATEMENTS, type DocumentId } from './constants.js'
import {
  acceptAgreement,
  grantConsent,
  registerAccount,
  withdrawConsent,
} from './consents.js'
import {
  activateDocuments,
  deactivateDocuments,
  importDocuments,
  readActiveDocument,
  readPublishedVersion,
} from './documents.js'
import { LegalError } from './errors.js'
import { sha256Utf8 } from './hash.js'
import { CLAIM_PREMIUM_GRANT_SQL } from '../payments/premiumGrantSql.js'
import type { ParsedDocument, Queryable, TransactionRunner } from './types.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(here, '../..')

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

function assertLocal(connectionString: string): void {
  const parsed = new URL(connectionString)
  if (parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') {
    throw new Error('refusing a database that is not on loopback')
  }
}

async function apply(client: pg.PoolClient, sql: string): Promise<void> {
  await client.query('BEGIN')
  try {
    await client.query(sql)
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}

async function main(): Promise<void> {
  const connectionString = process.env.GNH_TEST_DATABASE_URL
  if (!connectionString) throw new Error('GNH_TEST_DATABASE_URL is required')
  assertLocal(connectionString)
  const pool = new pg.Pool({ connectionString, ssl: false, max: 2 })
  const client = await pool.connect()
  const queryable: Queryable = {
    query: (async (sql, params) => {
      const result = await client.query(sql, params)
      return { rows: result.rows as Record<string, unknown>[] }
    }) as Queryable['query'],
  }
  const withTransaction: TransactionRunner = async (fn) => {
    const tx = await pool.connect()
    const txQuery: Queryable = {
      query: (async (sql, params) => {
        const result = await tx.query(sql, params)
        return { rows: result.rows as Record<string, unknown>[] }
      }) as Queryable['query'],
    }
    try {
      await tx.query('BEGIN')
      const value = await fn(txQuery)
      await tx.query('COMMIT')
      return value
    } catch (error) {
      await tx.query('ROLLBACK')
      throw error
    } finally {
      tx.release()
    }
  }
  try {
    const version = await client.query<{ version: string }>('SHOW server_version')
    console.log(`server_version: ${version.rows[0]?.version}`)

    await client.query('BEGIN')
    try {
      await client.query('CREATE TABLE gnh_atomicity_probe (id int)')
      await client.query('SELECT 1/0')
      await client.query('COMMIT')
      throw new Error('a failing statement committed')
    } catch (error) {
      await client.query('ROLLBACK')
      if (error instanceof Error && error.message === 'a failing statement committed') throw error
    }
    const probe = await client.query(`SELECT to_regclass('public.gnh_atomicity_probe') AS name`)
    if (probe.rows[0]?.name) throw new Error('failed transaction was not rolled back')
    console.log('atomicity: rollback removed the probe table')

    await apply(client, readSql('db/schema.sql'))
    await apply(client, readSql('db/migrations/002_plans_yookassa.sql'))
    await apply(
      client,
      `ALTER TABLE plans ADD COLUMN IF NOT EXISTS plan_id TEXT;
       UPDATE plans SET plan_id = id WHERE plan_id IS NULL;
       INSERT INTO plans (id, plan_id, title, price_rub, duration_days, is_active)
       VALUES ('premium_1m', 'premium_1m', 'Premium 1m', 259, 30, true)
       ON CONFLICT (id) DO UPDATE SET plan_id = EXCLUDED.plan_id;`
    )
    await apply(client, readSql('db/migrations/004_payments_premium_granted_at.sql'))
    await apply(client, readSql('db/migrations/005_legal_documents.sql'))
    console.log('migration 005: applied in one transaction')

    const privacy = fiction('privacy')
    const draft = fiction('privacy', '2026-12-01.1', 'FICTIONAL privacy NEVER PUBLISHED\n')
    const agreement = fiction('agreement')
    const analytics = fiction('analytics')
    const changed = fiction('privacy', privacy.version, `${privacy.bodyMarkdown}CHANGED`)
    await importDocuments(withTransaction, [privacy, draft, agreement, analytics])
    await importDocuments(withTransaction, [privacy])
    try {
      await importDocuments(withTransaction, [changed])
      throw new Error('changed revision was imported')
    } catch (error) {
      if (!(error instanceof LegalError) || error.code !== 'document_version_conflict') throw error
    }
    if (await readPublishedVersion(queryable, 'privacy', draft.version)) {
      throw new Error('unpublished version was readable')
    }
    await activateDocuments(withTransaction, [privacy, agreement])
    if (!(await readActiveDocument(queryable, 'privacy'))) throw new Error('published privacy was not readable')
    await deactivateDocuments(withTransaction, ['privacy'])
    const kept = await readPublishedVersion(queryable, 'privacy', privacy.version)
    if (!kept || kept.active) throw new Error('deactivated published version disappeared')
    if (await readActiveDocument(queryable, 'privacy')) throw new Error('deactivated privacy stayed active')
    console.log('documents: import, conflict, publication history')

    const before = await client.query(`SELECT COUNT(*)::int AS count FROM legal_evidence`)
    try {
      await acceptAgreement(withTransaction, 501, { requestId: 'agreement-missing-501', accepted: true })
      throw new Error('agreement without a shown revision was stored')
    } catch (error) {
      if (!(error instanceof LegalError) || error.code !== 'version_mismatch') throw error
    }
    const afterReject = await client.query(`SELECT COUNT(*)::int AS count FROM legal_evidence`)
    if (Number(afterReject.rows[0]?.count) !== Number(before.rows[0]?.count)) {
      throw new Error('rejected revision created evidence')
    }
    const registered = await registerAccount(withTransaction, 501, {
      agreementRequestId: 'agreement-501',
      accepted: true,
      version: agreement.version,
      sha256: agreement.sha256,
    })
    if (!registered.agreement.active) throw new Error('account agreement was not stored')
    const user = await client.query(`SELECT telegram_id FROM users WHERE telegram_id = 501`)
    if (user.rows.length !== 1) throw new Error('account was not created with the agreement')
    const replay = await acceptAgreement(withTransaction, 501, {
      requestId: 'agreement-501',
      accepted: true,
      version: agreement.version,
      sha256: agreement.sha256,
    })
    if (!replay.idempotent || !replay.active) throw new Error('same agreement request was not idempotent')
    await activateDocuments(withTransaction, [analytics])
    await grantConsent(withTransaction, 501, {
      documentId: 'analytics',
      requestId: 'analytics-501',
      statement: STATEMENTS.analytics,
      version: analytics.version,
      sha256: analytics.sha256,
    })
    await withdrawConsent(withTransaction, 501, { documentId: 'analytics', requestId: 'analytics-withdraw-501' })
    const withdrawnReplay = await grantConsent(withTransaction, 501, {
      documentId: 'analytics',
      requestId: 'analytics-501',
      statement: STATEMENTS.analytics,
      version: analytics.version,
      sha256: analytics.sha256,
    })
    if (withdrawnReplay.active) throw new Error('replay after withdrawal restored consent')
    console.log('consents: shown revision, account, withdrawal replay')

    await client.query(
      `INSERT INTO payments (
         telegram_id, provider, plan_id, provider_payment_charge_id, status, currency, total_amount
       ) VALUES (501, 'yookassa', 'premium_1m', 'pay-old-local', 'pending', 'RUB', 259)`
    )
    const claimed = await client.query(CLAIM_PREMIUM_GRANT_SQL, ['pay-old-local'])
    if (!claimed.rows[0]?.premium_granted_at) throw new Error('old payment was not granted once')
    const second = await client.query(CLAIM_PREMIUM_GRANT_SQL, ['pay-old-local'])
    if (second.rows.length !== 0) throw new Error('old payment was granted twice')
    console.log('payments: one grant for an old paid order')
    console.log('postgres-check: ok')
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'postgres check failed'
  console.error(message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]'))
  process.exitCode = 1
})
