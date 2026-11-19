#!/usr/bin/env node
/**
 * Apply additive WEB migrations 012–021 (+ gnh_app grants) to production gnh_supabase.
 *
 * Does NOT:
 *  - run on API container start
 *  - touch gnh_web_staging
 *  - re-apply steps whose schema markers already exist
 *  - use staging role gnh_web_stage
 *
 * Modes:
 *   --dry-run      list steps / skip detection offline (no DB) when URL unset;
 *                  with URL + TLS, print which steps would apply (read-only)
 *   --preflight    TLS + identity + schema probe only (READ ONLY)
 *   (default)      transactional apply of missing steps after safety gates
 *
 * Safety gates for apply (all required):
 *   GNH_ALLOW_PROD_WEB_MIGRATE=1
 *   CONFIRM_PRODUCTION_WEB_MIGRATE=YES
 *   CONFIRM_PRODUCTION_BACKUP=YES
 *   PRODUCTION_DATABASE_URL → database name exactly gnh_supabase
 *   DATABASE_TLS_CA_FILE or DATABASE_TLS_CA_PEM (verified TLS)
 *
 * Usage (from server/, after npm run build:api):
 *   node scripts/apply-production-web-migrations.mjs --dry-run
 *   node scripts/apply-production-web-migrations.mjs --preflight
 *   GNH_ALLOW_PROD_WEB_MIGRATE=1 CONFIRM_PRODUCTION_WEB_MIGRATE=YES \\
 *     CONFIRM_PRODUCTION_BACKUP=YES \\
 *     PRODUCTION_DATABASE_URL='postgresql://…/gnh_supabase?sslmode=verify-full' \\
 *     DATABASE_TLS_CA_FILE=/path/to/timeweb-ca.crt \\
 *     node scripts/apply-production-web-migrations.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(__dirname, '..')
const dryRun = process.argv.includes('--dry-run')
const preflightOnly = process.argv.includes('--preflight')

const EXPECTED_DB = 'gnh_supabase'
const APP_ROLE = 'gnh_app'
const FORBIDDEN_DBS = new Set(['gnh_web_staging', 'gnh_web_local', 'postgres'])

/** @type {{ label: string, file: string, kind: 'ddl'|'grants', skipSql: string }[]} */
const steps = [
  {
    label: '012',
    file: 'db/migrations/012_web_sessions.sql',
    kind: 'ddl',
    skipSql: `SELECT to_regclass('public.web_sessions') IS NOT NULL AS present`,
  },
  {
    label: '013',
    file: 'db/migrations/013_web_session_profile.sql',
    kind: 'ddl',
    skipSql: `SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='web_sessions' AND column_name='display_name'
    ) AS present`,
  },
  {
    label: '014',
    file: 'db/migrations/014_legal_confirmation_source_web.sql',
    kind: 'ddl',
    skipSql: `SELECT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'legal_evidence_source_check'
        AND pg_get_constraintdef(oid) ILIKE '%web%'
    ) AS present`,
  },
  {
    label: '015',
    file: 'db/migrations/015_infected_rooms_code_digits.sql',
    kind: 'ddl',
    skipSql: `SELECT (
      to_regclass('public.infected_rooms') IS NULL
      OR EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'infected_rooms_code_format'
           AND pg_get_constraintdef(oid) LIKE '%0-9%'
      )
    ) AS present`,
  },
  {
    label: '017',
    file: 'db/migrations/017_web_anonymous_accounts.sql',
    kind: 'ddl',
    skipSql: `SELECT to_regclass('public.web_accounts') IS NOT NULL AS present`,
  },
  {
    label: '018',
    file: 'db/migrations/018_web_rate_buckets.sql',
    kind: 'ddl',
    skipSql: `SELECT to_regclass('public.web_rate_buckets') IS NOT NULL AS present`,
  },
  {
    label: '019',
    file: 'db/migrations/019_web_legal_subjects.sql',
    kind: 'ddl',
    skipSql: `SELECT to_regclass('public.web_legal_evidence') IS NOT NULL AS present`,
  },
  {
    label: '020',
    file: 'db/migrations/020_web_email_magic_links.sql',
    kind: 'ddl',
    skipSql: `SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='web_payments'
         AND column_name='receipt_email_normalized'
    ) AS present`,
  },
  {
    label: '021',
    file: 'db/migrations/021_game_session_leases.sql',
    kind: 'ddl',
    skipSql: `SELECT to_regclass('public.game_session_leases') IS NOT NULL AS present`,
  },
  {
    label: 'grants_web_gnh_app',
    file: 'db/production/grants_web_gnh_app.sql',
    kind: 'grants',
    skipSql: `SELECT (
      to_regclass('public.web_accounts') IS NOT NULL
      AND has_table_privilege('gnh_app', 'web_accounts', 'SELECT')
      AND (
        to_regclass('public.game_session_leases') IS NULL
        OR has_table_privilege('gnh_app', 'game_session_leases', 'SELECT')
      )
    ) AS present`,
  },
]

function resolve(rel) {
  return path.join(serverRoot, rel)
}

function redact(msg) {
  return String(msg)
    .replace(/postgresql:\/\/[^\s'"]+/gi, 'postgresql://***')
    .replace(/postgres:\/\/[^\s'"]+/gi, 'postgres://***')
    .replace(/password[=:]\s*\S+/gi, 'password=***')
}

function assertFilesExist() {
  for (const step of steps) {
    const full = resolve(step.file)
    if (!fs.existsSync(full)) throw new Error(`Missing ${step.file}`)
  }
}

function parseDbUrl(raw) {
  if (!raw) return null
  try {
    const u = new URL(raw)
    const dbName = decodeURIComponent(u.pathname.replace(/^\//, '').split('/')[0] || '')
    return { host: u.hostname, user: decodeURIComponent(u.username || ''), dbName }
  } catch {
    throw new Error('PRODUCTION_DATABASE_URL is not a valid URL')
  }
}

function assertProductionTarget(info) {
  if (!info) throw new Error('Set PRODUCTION_DATABASE_URL (preferred) or DATABASE_URL')
  if (!info.dbName || FORBIDDEN_DBS.has(info.dbName) || /gnh_web_/i.test(info.dbName)) {
    throw new Error(`Refusing database "${info.dbName}"`)
  }
  if (info.dbName !== EXPECTED_DB) {
    throw new Error(`Refusing: expected database ${EXPECTED_DB}, got "${info.dbName}"`)
  }
  if (!info.host) throw new Error('Host missing from database URL')
  if (!info.user) throw new Error('User missing from database URL')
  if (info.user === 'gnh_web_stage') {
    throw new Error('Refusing: do not use staging app role gnh_web_stage on production')
  }
  const expectHost = (process.env.PRODUCTION_EXPECT_HOST || process.env.STAGING_EXPECT_HOST || '').trim()
  if (expectHost && info.host.toLowerCase() !== expectHost.toLowerCase()) {
    throw new Error('Refusing: host does not match PRODUCTION_EXPECT_HOST')
  }
  const pgSslMode = (process.env.PGSSLMODE || '').trim().toLowerCase()
  if (pgSslMode === 'disable' || ['0', 'false', 'off', 'no', 'allow'].includes(pgSslMode)) {
    throw new Error('Refusing: PGSSLMODE disables TLS')
  }
}

async function loadResolvePgPoolConfig() {
  const distPath = path.join(serverRoot, 'dist', 'dbTls.js')
  if (!fs.existsSync(distPath)) {
    throw new Error('Missing dist/dbTls.js — run `npm run build:api` in server/ first')
  }
  const mod = await import(pathToFileURL(distPath).href)
  return mod.resolvePgPoolConfig
}

async function withClient(databaseUrl, fn) {
  process.env.DATABASE_URL = databaseUrl
  const resolvePgPoolConfig = await loadResolvePgPoolConfig()
  const resolved = resolvePgPoolConfig(process.env)
  if (!resolved.ssl || resolved.ssl.rejectUnauthorized !== true) {
    throw new Error('Refusing: TLS must verify server certificates (rejectUnauthorized)')
  }
  const client = new pg.Client({
    connectionString: resolved.connectionString,
    ssl: resolved.ssl,
    connectionTimeoutMillis: 30000,
    options: '-c default_transaction_read_only=on',
  })
  await client.connect()
  try {
    return await fn(client, resolved)
  } finally {
    await client.end()
  }
}

async function probeSkip(client, step) {
  const result = await client.query(step.skipSql)
  return Boolean(result.rows[0]?.present)
}

async function listPlan(client) {
  const plan = []
  for (const step of steps) {
    const skip = await probeSkip(client, step)
    plan.push({ ...step, skip })
  }
  return plan
}

async function runPreflight(databaseUrl) {
  await withClient(databaseUrl, async (client, resolved) => {
    const meta = await client.query(
      `SELECT current_database() AS db, current_user AS usr,
              (SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()) AS ssl`
    )
    const row = meta.rows[0]
    if (row.db !== EXPECTED_DB) throw new Error(`Wrong database: ${row.db}`)
    if (!row.ssl) throw new Error('TLS not active')
    const role = await client.query(`SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1) AS ok`, [
      APP_ROLE,
    ])
    if (!role.rows[0]?.ok) throw new Error(`Role ${APP_ROLE} missing`)
    const plan = await listPlan(client)
    console.log('PREFLIGHT_OK')
    console.log(`database=${row.db} user=${row.usr} tls=on ca=${resolved.summary.caSource}`)
    for (const step of plan) {
      console.log(`${step.skip ? 'SKIP' : 'NEED'} ${step.label} ${step.file}`)
    }
  })
}

async function runApply(databaseUrl) {
  if (process.env.GNH_ALLOW_PROD_WEB_MIGRATE !== '1') {
    throw new Error('Refusing: set GNH_ALLOW_PROD_WEB_MIGRATE=1 after backup + owner approval')
  }
  if (process.env.CONFIRM_PRODUCTION_WEB_MIGRATE !== 'YES') {
    throw new Error('Refusing: set CONFIRM_PRODUCTION_WEB_MIGRATE=YES')
  }
  if (process.env.CONFIRM_PRODUCTION_BACKUP !== 'YES') {
    throw new Error('Refusing: set CONFIRM_PRODUCTION_BACKUP=YES after a verified gnh_supabase backup')
  }

  process.env.DATABASE_URL = databaseUrl
  const resolvePgPoolConfig = await loadResolvePgPoolConfig()
  const resolved = resolvePgPoolConfig(process.env)
  if (!resolved.ssl || resolved.ssl.rejectUnauthorized !== true) {
    throw new Error('Refusing: TLS must verify server certificates')
  }

  const client = new pg.Client({
    connectionString: resolved.connectionString,
    ssl: resolved.ssl,
    connectionTimeoutMillis: 60000,
  })
  await client.connect()
  try {
    const meta = await client.query(`SELECT current_database() AS db`)
    if (meta.rows[0].db !== EXPECTED_DB) throw new Error(`Wrong database: ${meta.rows[0].db}`)

    const plan = await listPlan(client)
    const todo = plan.filter((s) => !s.skip)
    if (todo.length === 0) {
      console.log('Nothing to apply — schema already has WEB markers through 021 + grants.')
      return
    }

    await client.query('BEGIN')
    try {
      for (const step of todo) {
        const sql = fs.readFileSync(resolve(step.file), 'utf8')
        await client.query(sql)
        console.log('OK', step.label)
      }
      await client.query('COMMIT')
    } catch (e) {
      try {
        await client.query('ROLLBACK')
      } catch {
        /* ignore */
      }
      throw e
    }
    console.log('Production WEB migrations complete (missing steps only).')
  } finally {
    await client.end()
  }
}

async function main() {
  assertFilesExist()
  const databaseUrl = (process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL || '').trim()

  if (dryRun && !databaseUrl) {
    for (const step of steps) console.log('DRY', step.label, step.file)
    console.log('Dry-run OK (files only). No database contacted.')
    return
  }

  const info = parseDbUrl(databaseUrl)
  assertProductionTarget(info)

  if (dryRun) {
    await withClient(databaseUrl, async (client) => {
      const plan = await listPlan(client)
      for (const step of plan) {
        console.log(`${step.skip ? 'DRY_SKIP' : 'DRY_APPLY'} ${step.label} ${step.file}`)
      }
      console.log('Dry-run OK (read-only plan).')
    })
    return
  }

  if (preflightOnly) {
    await runPreflight(databaseUrl)
    return
  }

  await runApply(databaseUrl)
}

main().catch((e) => {
  console.error(redact(e instanceof Error ? e.message : e))
  process.exit(1)
})
