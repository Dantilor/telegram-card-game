import tls from 'node:tls'
import { pool } from '../db.js'
import { DOCUMENT_IDS } from './constants.js'
import { sameHash } from './hash.js'
import { loadLegalPackage } from './packageFile.js'
import type { Block } from './types.js'

const CORE_IDS = ['privacy', 'agreement', 'offer', 'pd_account'] as const
const LEGAL_TABLES = [
  'legal_document_versions',
  'legal_document_activations',
  'legal_evidence',
  'legal_preferences',
  'marketing_queue',
]
const PAYMENT_COLUMNS = ['offer_evidence_id', 'receipt_contact', 'receipt_contact_kind']

type StoredVersion = {
  document_id: string
  version: string
  sha256: string
  body_markdown: string
  blocks: Block[]
}

type StoredActivation = {
  document_id: string
  version: string
  sha256: string
  active: boolean
}

function fail(message: string): never {
  throw new Error(message)
}

function redact(error: unknown): string {
  const message = error instanceof Error ? error.message : 'database check failed'
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(source).sort()) sorted[key] = canonicalize(source[key])
    return sorted
  }
  return value
}

function sameBlocks(stored: unknown, expected: Block[]): boolean {
  return JSON.stringify(canonicalize(stored)) === JSON.stringify(canonicalize(expected))
}

function tlsSocket(client: { connection?: { stream?: unknown } }): tls.TLSSocket {
  const stream = client.connection?.stream
  if (!(stream instanceof tls.TLSSocket) || stream.authorized !== true || stream.authorizationError) {
    fail('TLS certificate was not verified')
  }
  const protocol = stream.getProtocol()
  if (protocol !== 'TLSv1.2' && protocol !== 'TLSv1.3') fail('TLS protocol is below TLSv1.2')
  return stream
}

async function withReadOnly<T>(fn: (client: import('pg').PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    tlsSocket(client as unknown as { connection?: { stream?: unknown } })
    await client.query("SET statement_timeout = '30s'")
    await client.query('BEGIN READ ONLY')
    try {
      const value = await fn(client)
      await client.query('ROLLBACK')
      return value
    } catch (error) {
      try {
        await client.query('ROLLBACK')
      } catch {
        // The original error is reported.
      }
      throw error
    }
  } finally {
    client.release()
  }
}

async function sessionIdentity(): Promise<{ database: string; user: string; tlsVersion: string }> {
  return withReadOnly(async (client) => {
    const row = await client.query<{
      current_database: string
      role_name: string
      ssl: boolean
      tls_version: string | null
    }>(
      `SELECT current_database() AS current_database,
              current_user AS role_name,
              ssl.ssl,
              ssl.version AS tls_version
         FROM pg_stat_ssl AS ssl
        WHERE ssl.pid = pg_backend_pid()`
    )
    const identity = row.rows[0]
    if (!identity?.ssl) fail('PostgreSQL session is not using TLS')
    const expectedDatabase = process.env.GNH_EXPECT_DATABASE?.trim()
    const expectedUser = process.env.GNH_EXPECT_USER?.trim()
    if (!expectedDatabase || !expectedUser) fail('expected database and user are required')
    if (identity.current_database !== expectedDatabase) {
      fail(`current_database=${identity.current_database} expected ${expectedDatabase}`)
    }
    if (identity.role_name !== expectedUser) fail(`current_user=${identity.role_name} expected ${expectedUser}`)
    return {
      database: identity.current_database,
      user: identity.role_name,
      tlsVersion: identity.tls_version ?? 'unknown',
    }
  })
}

async function assertSchema(): Promise<void> {
  await withReadOnly(async (client) => {
    const tables = await client.query<{ table_name: string }>(
      `SELECT c.relname AS table_name
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND c.relname = ANY($1::text[])`,
      [LEGAL_TABLES]
    )
    if (tables.rows.length !== LEGAL_TABLES.length) fail('legal schema 005 is incomplete')
    const columns = await client.query<{ column_name: string; is_nullable: string }>(
      `SELECT column_name, is_nullable
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'payments'
          AND column_name = ANY($1::text[])`,
      [PAYMENT_COLUMNS]
    )
    if (columns.rows.length !== PAYMENT_COLUMNS.length) fail('payment legal columns are missing')
    if (columns.rows.some((column) => column.is_nullable !== 'YES')) fail('payment legal columns are not nullable')
  })
}

async function readVersions(): Promise<StoredVersion[]> {
  return withReadOnly(async (client) => {
    const result = await client.query<StoredVersion>(
      `SELECT document_id, version, sha256, body_markdown, blocks
         FROM legal_document_versions
        ORDER BY document_id, version`
    )
    return result.rows
  })
}

async function readActivations(): Promise<StoredActivation[]> {
  return withReadOnly(async (client) => {
    const result = await client.query<StoredActivation>(
      `SELECT document_id, version, sha256, (deactivated_at IS NULL) AS active
         FROM legal_document_activations`
    )
    return result.rows
  })
}

async function sideCounts(): Promise<{ evidence: number; preferences: number; queue: number }> {
  return withReadOnly(async (client) => {
    const result = await client.query<{ evidence: number; preferences: number; queue: number }>(
      `SELECT
         (SELECT count(*)::int FROM legal_evidence) AS evidence,
         (SELECT count(*)::int FROM legal_preferences) AS preferences,
         (SELECT count(*)::int FROM marketing_queue) AS queue`
    )
    const row = result.rows[0]
    if (!row) fail('legal side counts are missing')
    return row
  })
}

async function comparePackage(file: string): Promise<string[]> {
  const loaded = loadLegalPackage(file)
  const stored = await readVersions()
  if (stored.length !== loaded.documents.length) {
    fail(`stored document rows=${stored.length} expected ${loaded.documents.length}`)
  }
  const lines: string[] = []
  for (const document of loaded.documents) {
    const row = stored.find((item) => item.document_id === document.id && item.version === document.version)
    if (!row) fail(`${document.id}: stored version is missing`)
    const hash = row.sha256.trim().toLowerCase()
    if (!sameHash(hash, document.sha256) || row.body_markdown !== document.bodyMarkdown || !sameBlocks(row.blocks, document.blocks)) {
      fail(`${document.id}@${document.version}: stored content does not match the package`)
    }
    lines.push(`${document.id} ${document.version} sha256=${hash}`)
  }
  const expectedIds = new Set(DOCUMENT_IDS)
  if (stored.some((row) => !expectedIds.has(row.document_id as (typeof DOCUMENT_IDS)[number]))) {
    fail('stored documents include an unexpected id')
  }
  return lines
}

function assertNoSideRows(counts: { evidence: number; preferences: number; queue: number }): void {
  if (counts.evidence !== 0 || counts.preferences !== 0 || counts.queue !== 0) {
    fail(`unexpected legal rows evidence=${counts.evidence} preferences=${counts.preferences} queue=${counts.queue}`)
  }
}

function fileArg(argv: string[]): string {
  const index = argv.indexOf('--file')
  const file = index === -1 ? undefined : argv[index + 1]
  if (!file) fail('--file is required')
  return file
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2)
  const identity = await sessionIdentity()
  await assertSchema()
  if (command === 'preflight') {
    process.stdout.write(`current_database: ${identity.database}\n`)
    process.stdout.write(`current_user: ${identity.user}\n`)
    process.stdout.write(`ssl: true\n`)
    process.stdout.write(`tls_version: ${identity.tlsVersion}\n`)
    process.stdout.write('legal_tables: 5\n')
    process.stdout.write(`payment_columns: ${PAYMENT_COLUMNS.join(',')}\n`)
    return
  }
  const lines = await comparePackage(fileArg(rest))
  const counts = await sideCounts()
  assertNoSideRows(counts)
  const activations = await readActivations()
  if (command === 'verify-import') {
    if (activations.length !== 0) fail(`activations=${activations.length} expected 0`)
    for (const line of lines) process.stdout.write(`${line}\n`)
    process.stdout.write('activations: 0\nevidence: 0\npreferences: 0\nqueue: 0\ncontent: match\n')
    return
  }
  if (command === 'verify-core-ready') {
    if (activations.some((row) => !CORE_IDS.includes(row.document_id as (typeof CORE_IDS)[number]))) {
      fail('an activation outside privacy, agreement, offer, and pd_account is present')
    }
    const active = activations.filter((row) => row.active)
    if (active.length !== 0 && active.length !== CORE_IDS.length) {
      fail(`active activations=${active.length} expected 0 or 4`)
    }
    for (const row of activations) {
      const expected = lines.find((line) => line.startsWith(`${row.document_id} `))
      const hash = row.sha256.trim().toLowerCase()
      if (!expected || !expected.includes(`sha256=${hash}`) || !expected.includes(` ${row.version} `)) {
        fail(`${row.document_id}: activation does not match the imported revision`)
      }
    }
    process.stdout.write(active.length === 0 ? 'ready: clear\n' : 'ready: already-active\n')
    process.stdout.write('evidence: 0\npreferences: 0\nqueue: 0\ncontent: match\n')
    return
  }
  if (command === 'verify-activate') {
    const active = activations.filter((row) => row.active)
    const activeIds = CORE_IDS.filter((id) => active.some((row) => row.document_id === id))
    if (active.length !== CORE_IDS.length || activeIds.length !== CORE_IDS.length) {
      fail(`active activations=${active.length} expected ${CORE_IDS.length}`)
    }
    for (const row of activations) {
      if (!CORE_IDS.includes(row.document_id as (typeof CORE_IDS)[number])) {
        fail(`${row.document_id}: unexpected activation`)
      }
      const expected = lines.find((line) => line.startsWith(`${row.document_id} `))
      const hash = row.sha256.trim().toLowerCase()
      if (!expected || !expected.includes(`sha256=${hash}`) || !expected.includes(` ${row.version} `)) {
        fail(`${row.document_id}: activation does not match the imported revision`)
      }
    }
    for (const line of lines) process.stdout.write(`${line}\n`)
    process.stdout.write(`active: ${CORE_IDS.join(',')}\n`)
    process.stdout.write('activations_active: 4\nevidence: 0\npreferences: 0\nqueue: 0\ncontent: match\n')
    return
  }
  fail('usage: documentCheck.ts preflight | verify-import --file <package> | verify-core-ready --file <package> | verify-activate --file <package>')
}

main()
  .catch((error: unknown) => {
    console.error(redact(error))
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
