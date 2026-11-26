import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { DOCUMENT_CATALOG } from './constants.js'
import { activateDocuments, importDocuments } from './documents.js'
import { sha256Utf8 } from './hash.js'
import type { ParsedDocument, Queryable, TransactionRunner } from './types.js'
import {
  METRIKA_CONSENT_STATEMENT,
  METRIKA_CONSENT_UI_VERSION,
  recordWebMetrikaConsent,
} from './webMetrikaConsent.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(here, '../..')

function readSql(rel: string): string {
  return fs.readFileSync(path.join(serverRoot, rel), 'utf8')
}

function privacyDoc(version = '2026-11-26.2'): ParsedDocument {
  const text = `FICTIONAL privacy ${version}\n`
  const catalog = DOCUMENT_CATALOG.privacy
  return {
    id: 'privacy',
    version,
    title: 'Privacy',
    kind: catalog.kind,
    scope: catalog.scope,
    documentDate: '2026-11-26',
    sha256: sha256Utf8(text),
    bodyMarkdown: text,
    blocks: [{ type: 'paragraph', text: text.trim() }],
    requiresIndividualDetails: catalog.individual,
  }
}

async function createHarness() {
  const pg = new PGlite()
  await pg.exec(readSql('db/schema.sql'))
  await pg.exec(readSql('db/migrations/005_legal_documents.sql'))
  await pg.exec(readSql('db/migrations/012_web_sessions.sql'))
  await pg.exec(readSql('db/migrations/013_web_session_profile.sql'))
  await pg.exec(readSql('db/migrations/017_web_anonymous_accounts.sql'))
  await pg.exec(readSql('db/migrations/019_web_legal_subjects.sql'))

  const wrap = (client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> }): Queryable => ({
    query: async <T>(sql: string, params?: unknown[]) => {
      const result = await client.query(sql, params)
      return { rows: result.rows as T[] }
    },
  })
  const query = wrap(pg)
  const withTransaction: TransactionRunner = (fn) => pg.transaction(async (tx) => fn(wrap(tx)))
  const privacy = privacyDoc()
  await importDocuments(withTransaction, [privacy])
  await activateDocuments(withTransaction, [privacy])
  return { query, withTransaction, close: () => pg.close() }
}

test('web metrika grant writes evidence then withdraw stops active preference', async () => {
  const h = await createHarness()
  try {
    const account = await h.query.query<{ id: string }>(`INSERT INTO web_accounts DEFAULT VALUES RETURNING id`)
    const webAccountId = String(account.rows[0]!.id)
    const granted = await recordWebMetrikaConsent(h.withTransaction, webAccountId, {
      action: 'grant',
      requestId: 'gnhmetrika_grant_001',
      consentUiVersion: METRIKA_CONSENT_UI_VERSION,
      statement: METRIKA_CONSENT_STATEMENT,
    })
    assert.equal(granted.state, 'granted')
    assert.equal(granted.active, true)
    assert.equal(granted.channel, 'yandex_metrika')
    assert.equal(granted.version, '2026-11-26.2')

    const withdrawn = await recordWebMetrikaConsent(h.withTransaction, webAccountId, {
      action: 'withdraw',
      requestId: 'gnhmetrika_withdraw_001',
      consentUiVersion: METRIKA_CONSENT_UI_VERSION,
    })
    assert.equal(withdrawn.state, 'withdrawn')
    assert.equal(withdrawn.active, false)
  } finally {
    await h.close()
  }
})

test('web metrika grant rejects wrong statement and does not enable preference', async () => {
  const h = await createHarness()
  try {
    const account = await h.query.query<{ id: string }>(`INSERT INTO web_accounts DEFAULT VALUES RETURNING id`)
    const webAccountId = String(account.rows[0]!.id)
    await assert.rejects(
      () =>
        recordWebMetrikaConsent(h.withTransaction, webAccountId, {
          action: 'grant',
          requestId: 'gnhmetrika_bad_stmt',
          consentUiVersion: METRIKA_CONSENT_UI_VERSION,
          statement: 'wrong',
        }),
      (err: unknown) => (err as { code?: string }).code === 'statement_mismatch'
    )
    const prefs = await h.query.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM web_legal_preferences WHERE subject_web_account_id = $1::uuid`,
      [webAccountId]
    )
    assert.equal(prefs.rows[0]?.n, '0')
  } finally {
    await h.close()
  }
})
