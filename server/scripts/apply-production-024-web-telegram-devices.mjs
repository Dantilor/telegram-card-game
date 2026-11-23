/**
 * Production-only applicator for migration 024 (web_telegram_devices) + gnh_app grants.
 *
 * Scope: ONLY 024 DDL + grants_web_telegram_devices_gnh_app.sql
 * Does NOT apply 012–023, does NOT touch plans/tariffs, is NOT imported by API startup.
 * Do not run against production until Phase A device-limit release is approved.
 *
 * Production API privileges: table grants target role gnh_app (cluster NOLOGIN /
 * app role used by production API via DATABASE_URL membership / SET ROLE model —
 * see grants_web_gnh_app.sql, 011_party_app_grants.sql, WEB_STAGING_MIGRATIONS.md).
 * Migrate as cluster admin LOGIN (often gen_user), never gnh_web_stage.
 *
 * Modes:
 *   --dry-run     print planned steps (no DB required if URL unset)
 *   --preflight   connect + schema/TLS/db/role checks (no writes)
 *   (default)     apply after explicit confirmations
 *
 * Env (apply):
 *   PRODUCTION_DATABASE_URL or DATABASE_URL  → must be …/gnh_supabase with verified TLS
 *   GNH_ALLOW_PROD_WEB_MIGRATE=1
 *   CONFIRM_PRODUCTION_WEB_MIGRATE=YES
 *   CONFIRM_PRODUCTION_BACKUP=YES
 *   CONFIRM_PRODUCTION_024_DEVICES=YES
 *
 * Example (do not run on production now):
 *   npm run migrate:production-024:dry
 *   npm run migrate:production-024:preflight
 *   GNH_ALLOW_PROD_WEB_MIGRATE=1 CONFIRM_PRODUCTION_WEB_MIGRATE=YES \
 *     CONFIRM_PRODUCTION_BACKUP=YES CONFIRM_PRODUCTION_024_DEVICES=YES \
 *     PRODUCTION_DATABASE_URL='…' npm run migrate:production-024
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import pg from 'pg'

const here = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.join(here, '..')

export const EXPECTED_DB = 'gnh_supabase'
export const FORBIDDEN_DBS = new Set(['gnh_web_staging', 'postgres', 'template0', 'template1'])
export const APP_ROLE = 'gnh_app'

const SKIP_024_SQL = `
SELECT
  to_regclass('public.web_telegram_devices') IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'web_telegram_link_challenges'
      AND column_name = 'device_token_hash'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'web_telegram_link_challenges'
      AND column_name = 'last_error_code'
  ) AS present
`

const SKIP_GRANTS_SQL = `
SELECT
  to_regclass('public.web_telegram_devices') IS NOT NULL
  AND has_table_privilege('gnh_app', 'web_telegram_devices', 'SELECT')
  AND has_table_privilege('gnh_app', 'web_telegram_devices', 'INSERT')
  AND has_table_privilege('gnh_app', 'web_telegram_devices', 'UPDATE')
  AND has_table_privilege('gnh_app', 'web_telegram_devices', 'DELETE')
  AS present
`

const PREREQ_SQL = `
SELECT
  to_regclass('public.web_accounts') IS NOT NULL AS has_web_accounts,
  to_regclass('public.web_telegram_links') IS NOT NULL AS has_web_telegram_links,
  to_regclass('public.web_telegram_link_challenges') IS NOT NULL AS has_challenges
`

/** @typedef {{ label: string, file: string, kind: 'ddl'|'grants', skipSql: string }} Step */

/** @type {Step[]} */
export const STEPS = Object.freeze([
  {
    label: '024',
    file: 'db/migrations/024_web_telegram_devices.sql',
    kind: 'ddl',
    skipSql: SKIP_024_SQL,
  },
  {
    label: 'grants_web_telegram_devices_gnh_app',
    file: 'db/production/grants_web_telegram_devices_gnh_app.sql',
    kind: 'grants',
    skipSql: SKIP_GRANTS_SQL,
  },
])

export function parseArgs(argv = process.argv) {
  const dryRun = argv.includes('--dry-run')
  const preflight = argv.includes('--preflight')
  if (dryRun && preflight) {
    throw new Error('Use only one of --dry-run or --preflight')
  }
  return { dryRun, preflight, apply: !dryRun && !preflight }
}

export function assertApplyConfirmations(env = process.env) {
  if (env.GNH_ALLOW_PROD_WEB_MIGRATE !== '1') {
    throw new Error('Refusing apply: set GNH_ALLOW_PROD_WEB_MIGRATE=1 after backup + owner approval')
  }
  if (env.CONFIRM_PRODUCTION_WEB_MIGRATE !== 'YES') {
    throw new Error('Refusing apply: set CONFIRM_PRODUCTION_WEB_MIGRATE=YES')
  }
  if (env.CONFIRM_PRODUCTION_BACKUP !== 'YES') {
    throw new Error(
      'Refusing apply: set CONFIRM_PRODUCTION_BACKUP=YES after verified gnh_supabase backup/snapshot'
    )
  }
  if (env.CONFIRM_PRODUCTION_024_DEVICES !== 'YES') {
    throw new Error(
      'Refusing apply: set CONFIRM_PRODUCTION_024_DEVICES=YES (explicit 024-only confirmation)'
    )
  }
}

function resolve(rel) {
  return path.join(serverRoot, rel)
}

function redact(msg) {
  return String(msg)
    .replace(/postgresql:\/\/[^\s'"]+/gi, 'postgresql://***')
    .replace(/postgres:\/\/[^\s'"]+/gi, 'postgres://***')
    .replace(/password[=:]\s*\S+/gi, 'password=***')
}

export function assertFilesExist(steps = STEPS) {
  for (const step of steps) {
    const full = resolve(step.file)
    if (!fs.existsSync(full)) throw new Error(`Missing ${step.file}`)
  }
}

export function parseDbUrl(raw) {
  if (!raw) return null
  try {
    const u = new URL(raw)
    const dbName = decodeURIComponent(u.pathname.replace(/^\//, '').split('/')[0] || '')
    return { host: u.hostname, user: decodeURIComponent(u.username || ''), dbName }
  } catch {
    throw new Error('PRODUCTION_DATABASE_URL is not a valid URL')
  }
}

export function assertProductionTarget(info) {
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
  const expectHost = (process.env.PRODUCTION_EXPECT_HOST || '').trim()
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

async function withClient(databaseUrl, fn, { readOnly = true } = {}) {
  process.env.DATABASE_URL = databaseUrl
  const resolvePgPoolConfig = await loadResolvePgPoolConfig()
  const resolved = resolvePgPoolConfig(process.env)
  if (!resolved.ssl || resolved.ssl.rejectUnauthorized !== true) {
    throw new Error('Refusing: TLS must verify server certificates (rejectUnauthorized)')
  }
  /** @type {import('pg').ClientConfig} */
  const cfg = {
    connectionString: resolved.connectionString,
    ssl: resolved.ssl,
    connectionTimeoutMillis: 30000,
  }
  if (readOnly) {
    cfg.options = '-c default_transaction_read_only=on'
  }
  const client = new pg.Client(cfg)
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

async function assertPrerequisites(client) {
  const { rows } = await client.query(PREREQ_SQL)
  const row = rows[0] || {}
  const missing = []
  if (!row.has_web_accounts) missing.push('web_accounts')
  if (!row.has_web_telegram_links) missing.push('web_telegram_links')
  if (!row.has_challenges) missing.push('web_telegram_link_challenges')
  if (missing.length) {
    throw new Error(
      `024 prerequisites missing (${missing.join(', ')}). Apply through-022 first; this script never applies 012–023.`
    )
  }
}

export async function inspectAppRole(client) {
  const { rows } = await client.query(
    `SELECT r.rolname,
            r.rolcanlogin,
            pg_has_role(current_user, r.oid, 'member') AS migrate_user_is_member
       FROM pg_roles r
      WHERE r.rolname = $1`,
    [APP_ROLE]
  )
  if (!rows[0]) {
    throw new Error(`Role ${APP_ROLE} does not exist (production API privilege role)`)
  }
  return {
    role: rows[0].rolname,
    canLogin: Boolean(rows[0].rolcanlogin),
    migrateUserIsMember: Boolean(rows[0].migrate_user_is_member),
  }
}

async function listPlan(client, steps = STEPS) {
  const plan = []
  for (const step of steps) {
    const skip = await probeSkip(client, step)
    plan.push({ ...step, skip })
  }
  return plan
}

function printDryRunFilesOnly() {
  console.log('phase=024-devices')
  for (const step of STEPS) {
    console.log(`DRY ${step.label} ${step.file}`)
  }
  console.log(`app_role=${APP_ROLE} (grants target; production API privilege role)`)
  console.log('NOTE: 012–023 and plan/tariff changes are excluded.')
  console.log('Confirmations for apply: GNH_ALLOW_PROD_WEB_MIGRATE=1')
  console.log('  CONFIRM_PRODUCTION_WEB_MIGRATE=YES')
  console.log('  CONFIRM_PRODUCTION_BACKUP=YES')
  console.log('  CONFIRM_PRODUCTION_024_DEVICES=YES')
  console.log('Dry-run OK (files only). No database contacted.')
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
    await assertPrerequisites(client)
    const appRole = await inspectAppRole(client)
    const plan = await listPlan(client)
    console.log('PREFLIGHT_OK')
    console.log(
      `phase=024-devices database=${row.db} migrate_user=${row.usr} tls=on ca=${resolved.summary.caSource}`
    )
    console.log(
      `app_role=${appRole.role} can_login=${appRole.canLogin} migrate_user_member_of_app_role=${appRole.migrateUserIsMember}`
    )
    console.log(
      'NOTE: production API uses DATABASE_URL; table DML is granted to gnh_app (see grants_web_gnh_app.sql).'
    )
    for (const step of plan) {
      console.log(`${step.skip ? 'SKIP' : 'NEED'} ${step.label} ${step.file}`)
    }
  })
}

async function runApply(databaseUrl) {
  assertApplyConfirmations(process.env)

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
    const meta = await client.query(`SELECT current_database() AS db, current_user AS usr`)
    if (meta.rows[0].db !== EXPECTED_DB) throw new Error(`Wrong database: ${meta.rows[0].db}`)
    await assertPrerequisites(client)
    await inspectAppRole(client)

    const plan = await listPlan(client)
    const todo = plan.filter((s) => !s.skip)
    if (todo.length === 0) {
      console.log('Nothing to apply — 024 schema + gnh_app grants already present.')
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

    const after = await listPlan(client)
    const stillNeeded = after.filter((s) => !s.skip)
    if (stillNeeded.length) {
      throw new Error(
        `Post-apply verification failed: still need ${stillNeeded.map((s) => s.label).join(', ')}`
      )
    }
    console.log('024 complete: web_telegram_devices + gnh_app grants (012–023 untouched).')
  } finally {
    await client.end()
  }
}

async function main() {
  assertFilesExist(STEPS)
  const mode = parseArgs(process.argv)
  const databaseUrl = (process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL || '').trim()

  if (mode.dryRun && !databaseUrl) {
    printDryRunFilesOnly()
    return
  }

  const info = parseDbUrl(databaseUrl)
  assertProductionTarget(info)

  if (mode.dryRun) {
    await withClient(databaseUrl, async (client) => {
      await assertPrerequisites(client)
      const plan = await listPlan(client)
      console.log('phase=024-devices')
      for (const step of plan) {
        console.log(`${step.skip ? 'DRY_SKIP' : 'DRY_APPLY'} ${step.label} ${step.file}`)
      }
      console.log('NOTE: 012–023 excluded from this dry-run.')
      console.log('Dry-run OK (read-only plan).')
    })
    return
  }

  if (mode.preflight) {
    await runPreflight(databaseUrl)
    return
  }

  await runApply(databaseUrl)
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectRun) {
  main().catch((e) => {
    console.error(redact(e instanceof Error ? e.message : e))
    process.exit(1)
  })
}