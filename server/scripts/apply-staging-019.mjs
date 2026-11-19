/**
 * Apply ONLY migration 019 (+ 019-only grants) to gnh_web_staging.
 * Does NOT re-run 017/018. Does NOT touch gnh_supabase / production.
 *
 * Usage (from server/):
 *   node --env-file=.env.staging.local scripts/apply-staging-019.mjs --dry-run
 *   node --env-file=.env.staging.local scripts/apply-staging-019.mjs --preflight
 *   node --env-file=.env.staging.local scripts/apply-staging-019.mjs --check-connection
 *   node --env-file=.env.staging.local scripts/apply-staging-019.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const EXPECTED_DB = 'gnh_web_staging'
const FORBIDDEN_DB = 'gnh_supabase'
const APP_ROLE = 'gnh_web_stage'
const MIGRATE_HINT = 'gnh_web_migrate'

const argv = new Set(process.argv.slice(2))
const dryRun = argv.has('--dry-run')
const preflightOnly = argv.has('--preflight')
const checkOnly = argv.has('--check-connection')

const steps = [
  { file: 'db/migrations/019_web_legal_subjects.sql', label: '019_web_legal_subjects' },
  { file: 'db/staging/03_grants_019_only.sql', label: 'grants_019_only' },
]

const PREREQ_TABLES = [
  'web_accounts',
  'web_entitlements',
  'web_telegram_links',
  'web_telegram_link_challenges',
  'web_email_otps',
  'web_payments',
  'web_rate_buckets',
]

function resolve(rel) {
  return path.join(root, rel)
}

function redactError(err) {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.replace(/:[^:@/]+@/g, ':***@').replace(/Password=[^;]+/gi, 'Password=***')
}

function assertIsolation(stagingUrl) {
  if (!stagingUrl) throw new Error('STAGING_DATABASE_URL is required')
  let u
  try {
    u = new URL(stagingUrl)
  } catch {
    throw new Error('STAGING_DATABASE_URL is not a valid URL')
  }
  const db = decodeURIComponent(u.pathname.replace(/^\//, ''))
  if (db === FORBIDDEN_DB) throw new Error('Refusing gnh_supabase (production)')
  if (db !== EXPECTED_DB) throw new Error(`Refusing database ${db}; expected ${EXPECTED_DB}`)
  if (u.username === APP_ROLE) {
    throw new Error(`Refusing app role ${APP_ROLE}; use ${MIGRATE_HINT}`)
  }
  return { host: u.hostname, database: db, user: u.username }
}

async function loadResolvePgPoolConfig() {
  const dist = path.join(root, 'dist', 'dbTls.js')
  const src = path.join(root, 'src', 'dbTls.ts')
  if (fs.existsSync(dist)) {
    const mod = await import(pathToFileURL(dist).href)
    return mod.resolvePgPoolConfig
  }
  if (fs.existsSync(src)) {
    await import('tsx/esm')
    const mod = await import(pathToFileURL(src).href)
    return mod.resolvePgPoolConfig
  }
  throw new Error('dbTls not found (run npm run build in server/)')
}

async function main() {
  console.log('Target: gnh_web_staging | steps: 019 + grants-019-only (single transaction; no 017/018)')

  if (dryRun) {
    for (const step of steps) {
      const full = resolve(step.file)
      if (!fs.existsSync(full)) throw new Error(`Missing ${step.file}`)
      console.log('DRY', step.label, step.file)
    }
    console.log('DRY_OK (019 pack only)')
    return
  }

  const stagingUrl = (process.env.STAGING_DATABASE_URL || '').trim()
  const meta = assertIsolation(stagingUrl)
  const resolvePgPoolConfig = await loadResolvePgPoolConfig()
  const resolved = resolvePgPoolConfig({
    ...process.env,
    DATABASE_URL: stagingUrl,
    GNH_EXPECT_HOST: process.env.STAGING_EXPECT_HOST,
    GNH_EXPECT_DATABASE: EXPECTED_DB,
    GNH_EXPECT_USER: process.env.STAGING_MIGRATE_USER || meta.user,
  })
  if (resolved.summary.rejectUnauthorized !== true) {
    throw new Error('TLS verification was not enabled')
  }
  if (resolved.summary.database !== EXPECTED_DB) {
    throw new Error('Resolved database is not gnh_web_staging')
  }
  if (resolved.summary.user === APP_ROLE) {
    throw new Error(`Refusing resolved migrate user ${APP_ROLE}`)
  }

  console.log('TLS:', {
    rejectUnauthorized: resolved.summary.rejectUnauthorized,
    servername: resolved.summary.servername,
    caSource: resolved.summary.caSource,
    host: resolved.summary.host,
    database: resolved.summary.database,
    user: resolved.summary.user,
  })

  if (preflightOnly) {
    console.log('PREFLIGHT_OK (019 pack); no connection opened.')
    return
  }

  const client = new pg.Client({ connectionString: resolved.connectionString, ssl: resolved.ssl })
  let transactionOpen = false
  try {
    await client.connect()
    const id = await client.query('select current_database() as db, current_user as usr')
    const row = id.rows[0]
    if (row.db !== EXPECTED_DB) throw new Error(`Connected DB mismatch: ${row.db}`)
    if (row.usr === APP_ROLE) throw new Error(`Connected as app role ${APP_ROLE}`)
    console.log('Connected:', { database: row.db, user: row.usr })

    for (const rel of PREREQ_TABLES) {
      const r = await client.query(`select to_regclass($1)::text as reg`, [`public.${rel}`])
      if (!r.rows[0]?.reg) {
        throw new Error(`Prerequisite table missing: ${rel} (apply 017/018 first via migrate:staging:web)`)
      }
    }

    if (checkOnly) {
      for (const rel of ['web_legal_evidence', 'web_legal_preferences']) {
        const r = await client.query(`select to_regclass($1)::text as reg`, [`public.${rel}`])
        console.log('table', rel, r.rows[0]?.reg ? 'PRESENT' : 'MISSING')
      }
      const grants = await client.query(
        `select table_name, privilege_type
         from information_schema.role_table_grants
         where grantee = $1 and table_schema = 'public'
           and table_name in ('web_legal_evidence', 'web_legal_preferences')
         order by table_name, privilege_type`,
        [APP_ROLE],
      )
      console.log('grants_for', APP_ROLE, grants.rows)
      console.log('CHECK_CONNECTION_OK (019 probes; no DDL)')
      return
    }

    await client.query('BEGIN')
    transactionOpen = true
    for (const step of steps) {
      const sql = fs.readFileSync(resolve(step.file), 'utf8')
      await client.query(sql)
      console.log('OK', step.label)
    }
    for (const rel of ['web_legal_evidence', 'web_legal_preferences']) {
      const r = await client.query(`select to_regclass($1)::text as reg`, [`public.${rel}`])
      if (!r.rows[0]?.reg) throw new Error(`Post-apply missing table ${rel}`)
      console.log('VERIFY', rel, 'PRESENT')
    }
    await client.query('COMMIT')
    transactionOpen = false
    console.log('DONE 019+grants on gnh_web_staging only (committed)')
  } catch (e) {
    if (transactionOpen) {
      try {
        await client.query('ROLLBACK')
        console.error('ROLLBACK applied after migrate error')
      } catch (rollbackErr) {
        console.error('ROLLBACK failed:', redactError(rollbackErr))
      }
      transactionOpen = false
    }
    throw e
  } finally {
    try {
      await client.end()
    } catch {
      // ignore
    }
  }
}

main()
  .then(() => {
    process.exitCode = 0
  })
  .catch((e) => {
    console.error(redactError(e))
    process.exitCode = 1
  })
