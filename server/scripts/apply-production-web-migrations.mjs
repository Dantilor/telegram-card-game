#!/usr/bin/env node
/**
 * Apply additive WEB migrations to production gnh_supabase in TWO explicit phases.
 *
 * Phase A — `--through-022` (DEFAULT for apply):
 *   missing steps 012…022 + grants_web_gnh_app
 *   NEVER applies 023 (WEB plans stay inactive → safe if API rolls back to ac49d0c)
 *
 * Phase B — `--activate-023` (explicit only):
 *   applies ONLY 023 after audience-aware API is live
 *   requires CONFIRM_PRODUCTION_WEB_PLANS_ACTIVATE=YES in addition to other gates
 *
 * Does NOT:
 *  - run on API container start
 *  - touch gnh_web_staging
 *  - re-apply steps whose schema markers already exist
 *  - use staging role gnh_web_stage
 *  - activate 023 unless --activate-023 + CONFIRM_PRODUCTION_WEB_PLANS_ACTIVATE=YES
 *
 * Modes:
 *   --dry-run         list selected phase steps / skip detection (read-only with URL)
 *   --preflight       TLS + identity + schema probe (READ ONLY)
 *   --through-022     Phase A (default when applying without --activate-023)
 *   --activate-023    Phase B only
 *
 * Safety gates for apply (all required):
 *   GNH_ALLOW_PROD_WEB_MIGRATE=1
 *   CONFIRM_PRODUCTION_WEB_MIGRATE=YES
 *   CONFIRM_PRODUCTION_BACKUP=YES
 *   PRODUCTION_DATABASE_URL → database name exactly gnh_supabase
 *   DATABASE_TLS_CA_FILE or DATABASE_TLS_CA_PEM (verified TLS)
 *
 * Extra gate for Phase B:
 *   CONFIRM_PRODUCTION_WEB_PLANS_ACTIVATE=YES
 *
 * Rollback before reverting API to a pre-audience build (e.g. ac49d0c):
 *   UPDATE plans SET is_active = false WHERE audience = 'web';
 *
 * Usage (from server/, after npm run build:api):
 *   node scripts/apply-production-web-migrations.mjs --dry-run --through-022
 *   node scripts/apply-production-web-migrations.mjs --preflight --through-022
 *   GNH_ALLOW_PROD_WEB_MIGRATE=1 CONFIRM_PRODUCTION_WEB_MIGRATE=YES \\
 *     CONFIRM_PRODUCTION_BACKUP=YES \\
 *     PRODUCTION_DATABASE_URL='postgresql://…/gnh_supabase?sslmode=verify-full' \\
 *     DATABASE_TLS_CA_FILE=/path/to/timeweb-ca.crt \\
 *     node scripts/apply-production-web-migrations.mjs --through-022
 *
 *   # Only after new API is live and Telegram still shows 259/399/990:
 *   … same gates … CONFIRM_PRODUCTION_WEB_PLANS_ACTIVATE=YES \\
 *     node scripts/apply-production-web-migrations.mjs --activate-023
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(__dirname, '..')

const EXPECTED_DB = 'gnh_supabase'
const APP_ROLE = 'gnh_app'
const FORBIDDEN_DBS = new Set(['gnh_web_staging', 'gnh_web_local', 'postgres'])

/** SQL to run BEFORE rolling API back past audience filtering. */
export const DEACTIVATE_WEB_PLANS_SQL =
  `UPDATE plans SET is_active = false WHERE audience = 'web';`

/** @typedef {'through-022' | 'activate-023'} MigrationPhase */
/** @typedef {{ label: string, file: string, kind: 'ddl'|'grants', skipSql: string, phase: MigrationPhase }} MigrationStep */

/** @type {MigrationStep[]} */
export const ALL_STEPS = [
  {
    label: '012',
    file: 'db/migrations/012_web_sessions.sql',
    kind: 'ddl',
    phase: 'through-022',
    skipSql: `SELECT to_regclass('public.web_sessions') IS NOT NULL AS present`,
  },
  {
    label: '013',
    file: 'db/migrations/013_web_session_profile.sql',
    kind: 'ddl',
    phase: 'through-022',
    skipSql: `SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='web_sessions' AND column_name='display_name'
    ) AS present`,
  },
  {
    label: '014',
    file: 'db/migrations/014_legal_confirmation_source_web.sql',
    kind: 'ddl',
    phase: 'through-022',
    skipSql: `SELECT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'legal_evidence_source_check'
        AND pg_get_constraintdef(oid) ILIKE '%web%'
    ) AS present`,
  },
  {
    label: '015',
    file: 'db/migrations/015_infected_rooms_code_digits.sql',
    kind: 'ddl',
    phase: 'through-022',
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
    phase: 'through-022',
    skipSql: `SELECT to_regclass('public.web_accounts') IS NOT NULL AS present`,
  },
  {
    label: '018',
    file: 'db/migrations/018_web_rate_buckets.sql',
    kind: 'ddl',
    phase: 'through-022',
    skipSql: `SELECT to_regclass('public.web_rate_buckets') IS NOT NULL AS present`,
  },
  {
    label: '019',
    file: 'db/migrations/019_web_legal_subjects.sql',
    kind: 'ddl',
    phase: 'through-022',
    skipSql: `SELECT to_regclass('public.web_legal_evidence') IS NOT NULL AS present`,
  },
  {
    label: '020',
    file: 'db/migrations/020_web_email_magic_links.sql',
    kind: 'ddl',
    phase: 'through-022',
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
    phase: 'through-022',
    skipSql: `SELECT to_regclass('public.game_session_leases') IS NOT NULL AS present`,
  },
  {
    label: '022',
    file: 'db/migrations/022_web_plans_audience.sql',
    kind: 'ddl',
    phase: 'through-022',
    skipSql: `SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='plans' AND column_name='audience'
    ) AND EXISTS (
      SELECT 1 FROM plans WHERE plan_id = 'premium_web_3m'
    ) AS present`,
  },
  {
    label: '023',
    file: 'db/migrations/023_web_plans_activate.sql',
    kind: 'ddl',
    phase: 'activate-023',
    skipSql: `SELECT EXISTS (
      SELECT 1 FROM plans
       WHERE plan_id = 'premium_web_3m' AND audience = 'web' AND is_active = true
    ) AS present`,
  },
  {
    label: 'grants_web_gnh_app',
    file: 'db/production/grants_web_gnh_app.sql',
    kind: 'grants',
    phase: 'through-022',
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

/**
 * @param {string[]} argv
 * @returns {MigrationPhase}
 */
export function parseMigrationPhase(argv = process.argv) {
  const activate = argv.includes('--activate-023')
  const through = argv.includes('--through-022')
  if (activate && through) {
    throw new Error('Refusing: pass only one of --through-022 or --activate-023')
  }
  if (activate) return 'activate-023'
  // Default apply / dry-run / preflight: Phase A never includes 023.
  return 'through-022'
}

/**
 * @param {MigrationPhase} phase
 * @param {MigrationStep[]} [steps]
 */
export function selectStepsForPhase(phase, steps = ALL_STEPS) {
  const selected = steps.filter((s) => s.phase === phase)
  if (phase === 'through-022') {
    if (selected.some((s) => s.label === '023')) {
      throw new Error('Invariant violated: Phase A must never include 023')
    }
    if (!selected.some((s) => s.label === '022')) {
      throw new Error('Invariant violated: Phase A must include 022')
    }
  }
  if (phase === 'activate-023') {
    if (selected.length !== 1 || selected[0]?.label !== '023') {
      throw new Error('Invariant violated: Phase B must be exactly step 023')
    }
  }
  return selected
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @param {MigrationPhase} phase
 */
export function assertApplyConfirmations(env, phase) {
  if (env.GNH_ALLOW_PROD_WEB_MIGRATE !== '1') {
    throw new Error('Refusing: set GNH_ALLOW_PROD_WEB_MIGRATE=1 after backup + owner approval')
  }
  if (env.CONFIRM_PRODUCTION_WEB_MIGRATE !== 'YES') {
    throw new Error('Refusing: set CONFIRM_PRODUCTION_WEB_MIGRATE=YES')
  }
  if (env.CONFIRM_PRODUCTION_BACKUP !== 'YES') {
    throw new Error('Refusing: set CONFIRM_PRODUCTION_BACKUP=YES after a verified gnh_supabase backup')
  }
  if (phase === 'activate-023') {
    if (env.CONFIRM_PRODUCTION_WEB_PLANS_ACTIVATE !== 'YES') {
      throw new Error(
        'Refusing: Phase B requires CONFIRM_PRODUCTION_WEB_PLANS_ACTIVATE=YES after audience-aware API is live'
      )
    }
  }
}

/** Reminder text used in docs/tests: deactivate WEB plans before rolling API to pre-audience builds. */
export function rollbackApiRequiresWebPlansDeactivated() {
  return {
    required: true,
    beforeApiRollbackTo: 'ac49d0c',
    sql: DEACTIVATE_WEB_PLANS_SQL,
    reason:
      'Legacy /api/plans lists every active plan. Active WEB rows would leak into Telegram after rollback.',
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

function assertFilesExist(steps) {
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

async function listPlan(client, steps) {
  const plan = []
  for (const step of steps) {
    const skip = await probeSkip(client, step)
    plan.push({ ...step, skip })
  }
  return plan
}

async function runPreflight(databaseUrl, steps, phase) {
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
    const plan = await listPlan(client, steps)
    console.log('PREFLIGHT_OK')
    console.log(`phase=${phase} database=${row.db} user=${row.usr} tls=on ca=${resolved.summary.caSource}`)
    for (const step of plan) {
      console.log(`${step.skip ? 'SKIP' : 'NEED'} ${step.label} ${step.file}`)
    }
    if (phase === 'through-022') {
      console.log('NOTE: 023 is excluded from this phase; use --activate-023 later.')
    }
  })
}

async function runApply(databaseUrl, steps, phase) {
  assertApplyConfirmations(process.env, phase)

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

    if (phase === 'activate-023') {
      const ready = await client.query(`SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema='public' AND table_name='plans' AND column_name='audience'
      ) AND EXISTS (
        SELECT 1 FROM plans WHERE plan_id = 'premium_web_3m' AND audience = 'web'
      ) AS present`)
      if (!ready.rows[0]?.present) {
        throw new Error(
          'Refusing Phase B: apply --through-022 first (audience column + inactive WEB plan rows required)'
        )
      }
    }

    const plan = await listPlan(client, steps)
    if (phase === 'through-022' && plan.some((s) => s.label === '023')) {
      throw new Error('Refusing: Phase A plan unexpectedly includes 023')
    }

    const todo = plan.filter((s) => !s.skip)
    if (todo.length === 0) {
      console.log(
        phase === 'activate-023'
          ? 'Nothing to apply — WEB plans already active (023 marker present).'
          : 'Nothing to apply — schema already has WEB markers through 022 + grants.'
      )
      return
    }

    await client.query('BEGIN')
    try {
      for (const step of todo) {
        if (phase === 'through-022' && step.label === '023') {
          throw new Error('Refusing: attempted to apply 023 during Phase A')
        }
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
    console.log(
      phase === 'activate-023'
        ? 'Phase B complete: WEB plans activated (023).'
        : 'Phase A complete: migrations through 022 + grants (023 not applied).'
    )
  } finally {
    await client.end()
  }
}

async function main() {
  const phase = parseMigrationPhase(process.argv)
  const steps = selectStepsForPhase(phase)
  assertFilesExist(ALL_STEPS)

  const dryRun = process.argv.includes('--dry-run')
  const preflightOnly = process.argv.includes('--preflight')
  const databaseUrl = (process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL || '').trim()

  if (dryRun && !databaseUrl) {
    console.log(`phase=${phase}`)
    for (const step of steps) console.log('DRY', step.label, step.file)
    if (phase === 'through-022') {
      console.log('NOTE: 023 excluded; re-run with --activate-023 only after audience-aware API is live.')
    }
    console.log('Dry-run OK (files only). No database contacted.')
    return
  }

  const info = parseDbUrl(databaseUrl)
  assertProductionTarget(info)

  if (dryRun) {
    await withClient(databaseUrl, async (client) => {
      const plan = await listPlan(client, steps)
      console.log(`phase=${phase}`)
      for (const step of plan) {
        console.log(`${step.skip ? 'DRY_SKIP' : 'DRY_APPLY'} ${step.label} ${step.file}`)
      }
      if (phase === 'through-022') {
        console.log('NOTE: 023 excluded from this dry-run phase.')
      }
      console.log('Dry-run OK (read-only plan).')
    })
    return
  }

  if (preflightOnly) {
    await runPreflight(databaseUrl, steps, phase)
    return
  }

  await runApply(databaseUrl, steps, phase)
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) {
  main().catch((e) => {
    console.error(redact(e instanceof Error ? e.message : e))
    process.exit(1)
  })
}
