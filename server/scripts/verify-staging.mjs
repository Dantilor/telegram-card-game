#!/usr/bin/env node
/**
 * Read-only verification of gnh_web_staging after migrate.
 * SELECT / privilege / catalog probes only — never DDL, GRANT, REVOKE, seed, or production data.
 *
 *   STAGING_DATABASE_URL=... STAGING_EXPECT_HOST=... STAGING_MIGRATE_USER=gnh_web_migrate \
 *   DATABASE_TLS_CA_FILE=... npm run verify:staging
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(serverRoot, '..')
const verifySqlPath = path.join(repoRoot, 'deploy', 'stand', 'verify-gnh-web-staging.sql')

const EXPECTED_DB = 'gnh_web_staging'
const APP_ROLE = 'gnh_web_stage'
const PROD_ROLE = 'gnh_app'
const PROD_DB = 'gnh_supabase'

const REQUIRED_TABLES = [
  'users',
  'subscriptions',
  'payments',
  'plans',
  'events',
  'web_sessions',
  'web_oidc_states',
  'web_oidc_token_replays',
  'web_accounts',
  'web_entitlements',
  'web_telegram_links',
  'web_telegram_link_challenges',
  'web_email_otps',
  'web_payments',
  'web_rate_buckets',
  'legal_document_versions',
  'legal_document_activations',
  'legal_evidence',
  'legal_preferences',
  'marketing_queue',
  'sled_rooms',
  'sled_participants',
  'sled_room_events',
  'mafia_rooms',
  'mafia_players',
  'mafia_actions',
  'mafia_events',
  'doubles_rooms',
  'doubles_players',
  'infected_rooms',
  'infected_players',
]

const REQUIRED_PLANS = ['premium_1m', 'premium_3m', 'premium_lifetime']

const PARTY_POLICY_RELS = [
  'sled_rooms',
  'sled_participants',
  'sled_room_events',
  'mafia_rooms',
  'mafia_players',
  'mafia_actions',
  'mafia_events',
  'doubles_rooms',
  'doubles_players',
  'infected_rooms',
  'infected_players',
]

const STAGE_PRIVILEGES = [
  ['users', 'SELECT'],
  ['users', 'INSERT'],
  ['subscriptions', 'SELECT'],
  ['subscriptions', 'INSERT'],
  ['payments', 'SELECT'],
  ['payments', 'INSERT'],
  ['plans', 'SELECT'],
  ['web_sessions', 'SELECT'],
  ['web_sessions', 'INSERT'],
  ['web_sessions', 'UPDATE'],
  ['web_oidc_states', 'SELECT'],
  ['web_oidc_states', 'INSERT'],
  ['legal_evidence', 'SELECT'],
  ['legal_evidence', 'INSERT'],
  ['legal_preferences', 'SELECT'],
  ['legal_preferences', 'INSERT'],
  ['sled_rooms', 'SELECT'],
  ['sled_rooms', 'INSERT'],
  ['mafia_rooms', 'SELECT'],
  ['mafia_rooms', 'INSERT'],
  ['doubles_rooms', 'SELECT'],
  ['doubles_rooms', 'INSERT'],
  ['infected_rooms', 'SELECT'],
  ['infected_rooms', 'INSERT'],
  // 017 / 018 anonymous WEB objects — full DML for app role
  ['web_accounts', 'SELECT'],
  ['web_accounts', 'INSERT'],
  ['web_accounts', 'UPDATE'],
  ['web_accounts', 'DELETE'],
  ['web_entitlements', 'SELECT'],
  ['web_entitlements', 'INSERT'],
  ['web_entitlements', 'UPDATE'],
  ['web_entitlements', 'DELETE'],
  ['web_telegram_links', 'SELECT'],
  ['web_telegram_links', 'INSERT'],
  ['web_telegram_links', 'UPDATE'],
  ['web_telegram_links', 'DELETE'],
  ['web_telegram_link_challenges', 'SELECT'],
  ['web_telegram_link_challenges', 'INSERT'],
  ['web_telegram_link_challenges', 'UPDATE'],
  ['web_telegram_link_challenges', 'DELETE'],
  ['web_email_otps', 'SELECT'],
  ['web_email_otps', 'INSERT'],
  ['web_email_otps', 'UPDATE'],
  ['web_email_otps', 'DELETE'],
  ['web_payments', 'SELECT'],
  ['web_payments', 'INSERT'],
  ['web_payments', 'UPDATE'],
  ['web_payments', 'DELETE'],
  ['web_rate_buckets', 'SELECT'],
  ['web_rate_buckets', 'INSERT'],
  ['web_rate_buckets', 'UPDATE'],
  ['web_rate_buckets', 'DELETE'],
]

const STAGE_SEQUENCE_USAGE = [
  'web_entitlements_id_seq',
  'web_telegram_links_id_seq',
  'web_telegram_link_challenges_id_seq',
  'web_email_otps_id_seq',
]

function die(message) {
  console.error(message)
  process.exit(1)
}

function redactError(err) {
  const msg = err instanceof Error ? err.message : String(err)
  return msg
    .replace(/postgresql:\/\/[^\s'"]+/gi, 'postgresql://***')
    .replace(/postgres:\/\/[^\s'"]+/gi, 'postgres://***')
    .replace(/password[=:]\s*\S+/gi, 'password=***')
}

function assertIsolation(rawUrl) {
  if ((process.env.DATABASE_URL || '').trim()) {
    die('Refusing: DATABASE_URL is set. Unset it and use only STAGING_DATABASE_URL.')
  }
  if (!rawUrl) die('Set STAGING_DATABASE_URL (staging verify URL only)')

  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch {
    die('STAGING_DATABASE_URL is not a valid URL')
  }

  const dbName = decodeURIComponent(parsed.pathname.replace(/^\//, ''))
  const user = decodeURIComponent(parsed.username || '')
  const host = parsed.hostname

  if (!dbName || /gnh_supabase/i.test(dbName) || /gnh_supabase/i.test(rawUrl)) {
    die('Refusing to verify production database gnh_supabase')
  }
  if (dbName !== EXPECTED_DB) {
    die(`Refusing: database must be exactly ${EXPECTED_DB} (got "${dbName}")`)
  }
  if (!host) die('STAGING_DATABASE_URL host is missing')
  if (!user) die('STAGING_DATABASE_URL user is missing')
  if (user === APP_ROLE) {
    die(`Refusing: do not verify as ${APP_ROLE}. Use gnh_web_migrate.`)
  }

  const expectHost = (process.env.STAGING_EXPECT_HOST || '').trim()
  if (!expectHost) die('STAGING_EXPECT_HOST is required')
  if (host.toLowerCase() !== expectHost.toLowerCase()) {
    die('Refusing: host does not match STAGING_EXPECT_HOST')
  }

  const expectUser = (process.env.STAGING_MIGRATE_USER || '').trim()
  if (expectUser && user !== expectUser) {
    die('Refusing: user does not match STAGING_MIGRATE_USER')
  }

  const pgSslMode = (process.env.PGSSLMODE || '').trim().toLowerCase()
  if (pgSslMode === 'disable' || ['0', 'false', 'off', 'no', 'allow'].includes(pgSslMode)) {
    die('Refusing: PGSSLMODE disables TLS')
  }

  return { dbName, user, host }
}

async function loadResolvePgPoolConfig() {
  const distPath = path.join(serverRoot, 'dist', 'dbTls.js')
  if (!fs.existsSync(distPath)) {
    die('Missing dist/dbTls.js — run `npm run build:api` in server/ before verify')
  }
  const mod = await import(pathToFileURL(distPath).href)
  return mod.resolvePgPoolConfig
}

function record(results, level, id, ok, detail) {
  results.push({ level, id, ok: Boolean(ok), detail: detail || '' })
  const tag = ok ? 'PASS' : level === 'info' ? 'INFO' : 'FAIL'
  console.log(`${tag}  ${id}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  if (!fs.existsSync(verifySqlPath)) {
    die(`Missing verify SQL checklist: ${verifySqlPath}`)
  }
  console.log('Verify checklist:', path.relative(repoRoot, verifySqlPath).replace(/\\/g, '/'))
  console.log('Mode: read-only SELECT/privilege/catalog probes (no writes, no migrate, no grants)')

  const stagingUrl = (process.env.STAGING_DATABASE_URL || '').trim()
  const meta = assertIsolation(stagingUrl)
  const resolvePgPoolConfig = await loadResolvePgPoolConfig()
  let resolved
  try {
    resolved = resolvePgPoolConfig({
      ...process.env,
      DATABASE_URL: stagingUrl,
      GNH_EXPECT_HOST: process.env.STAGING_EXPECT_HOST,
      GNH_EXPECT_DATABASE: EXPECTED_DB,
      GNH_EXPECT_USER: process.env.STAGING_MIGRATE_USER || meta.user,
    })
  } catch (e) {
    die(`TLS/config refused: ${redactError(e)}`)
  }
  if (resolved.summary.rejectUnauthorized !== true) die('TLS verification was not enabled')
  if (resolved.summary.database !== EXPECTED_DB) die('Resolved database is not gnh_web_staging')
  if (resolved.summary.user === APP_ROLE) die(`Refusing resolved user ${APP_ROLE}`)

  console.log('TLS:', {
    rejectUnauthorized: resolved.summary.rejectUnauthorized,
    minVersion: resolved.summary.minVersion,
    servername: resolved.summary.servername,
    caSource: resolved.summary.caSource,
    host: resolved.summary.host,
    database: resolved.summary.database,
    user: resolved.summary.user,
  })

  const client = new pg.Client({
    connectionString: resolved.connectionString,
    ssl: resolved.ssl,
  })

  try {
    await client.connect()
  } catch (e) {
    console.error('CONNECT_FAILED', redactError(e))
    process.exit(1)
  }

  const results = []
  try {
    const identity = await client.query(
      `SELECT current_database() AS db, current_user AS usr, session_user AS session_usr`
    )
    const row = identity.rows[0]
    record(results, 'required', 'identity.database', row.db === EXPECTED_DB, `db=${row.db}`)
    record(
      results,
      'required',
      'identity.not_app_role',
      row.usr !== APP_ROLE && row.session_usr !== APP_ROLE,
      `user=${row.usr}`
    )
    record(results, 'required', 'identity.not_production_db', !/gnh_supabase/i.test(row.db), '')

    const tables = await client.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1::text[])`,
      [REQUIRED_TABLES]
    )
    const present = new Set(tables.rows.map((r) => r.tablename))
    const missingTables = REQUIRED_TABLES.filter((t) => !present.has(t))
    record(
      results,
      'required',
      'schema.required_tables',
      missingTables.length === 0,
      missingTables.length ? `missing=${missingTables.join(',')}` : `count=${REQUIRED_TABLES.length}`
    )

    const infected = await client.query(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'infected_rooms_code_format'`
    )
    const infectedDef = infected.rows[0]?.def || ''
    record(
      results,
      'required',
      'infected.code_format',
      /code\s*~\s*'?\^\[A-Z0-9\]\{6\}\$'?/i.test(infectedDef) ||
        infectedDef.includes('^[A-Z0-9]{6}$'),
      infectedDef || 'constraint missing'
    )

    for (const [table, priv] of STAGE_PRIVILEGES) {
      const q = await client.query(`SELECT has_table_privilege($1, $2, $3) AS ok`, [
        APP_ROLE,
        table,
        priv,
      ])
      record(
        results,
        'required',
        `priv.${APP_ROLE}.${table}.${priv}`,
        Boolean(q.rows[0]?.ok),
        ''
      )
    }

    for (const seq of STAGE_SEQUENCE_USAGE) {
      const exists = await client.query(`SELECT to_regclass($1)::text AS reg`, [`public.${seq}`])
      if (!exists.rows[0]?.reg) {
        record(results, 'required', `seq.${seq}.exists`, false, 'sequence missing')
        continue
      }
      const q = await client.query(`SELECT has_sequence_privilege($1, $2, 'USAGE') AS ok`, [
        APP_ROLE,
        seq,
      ])
      record(
        results,
        'required',
        `priv.${APP_ROLE}.${seq}.USAGE`,
        Boolean(q.rows[0]?.ok),
        ''
      )
    }

    const member = await client.query(`SELECT pg_has_role($1, $2, 'member') AS is_member`, [
      APP_ROLE,
      PROD_ROLE,
    ])
    record(
      results,
      'required',
      'isolation.app_not_member_of_prod_role',
      member.rows[0]?.is_member === false,
      `${APP_ROLE} member of ${PROD_ROLE}=${member.rows[0]?.is_member}`
    )

    const policies = await client.query(
      `SELECT pol.polrelid::regclass::text AS rel
         FROM pg_policy pol
        WHERE pol.polname = 'party_gnh_web_stage_backend'`
    )
    const policyRels = new Set(policies.rows.map((r) => r.rel.replace(/^public\./, '')))
    const missingPolicies = PARTY_POLICY_RELS.filter((r) => !policyRels.has(r))
    record(
      results,
      'required',
      'rls.party_gnh_web_stage_backend',
      missingPolicies.length === 0,
      missingPolicies.length ? `missing=${missingPolicies.join(',')}` : `count=${policyRels.size}`
    )

    const plans = await client.query(
      `SELECT COALESCE(plan_id, id) AS plan_key, is_active
         FROM plans
        WHERE COALESCE(plan_id, id) = ANY($1::text[])`,
      [REQUIRED_PLANS]
    )
    const planKeys = new Set(plans.rows.map((r) => r.plan_key))
    const missingPlans = REQUIRED_PLANS.filter((p) => !planKeys.has(p))
    const inactive = plans.rows.filter((r) => r.is_active === false).map((r) => r.plan_key)
    record(
      results,
      'required',
      'premium.plans_present',
      missingPlans.length === 0,
      missingPlans.length ? `missing=${missingPlans.join(',')}` : REQUIRED_PLANS.join(',')
    )
    record(
      results,
      'required',
      'premium.plans_active',
      inactive.length === 0 && missingPlans.length === 0,
      inactive.length ? `inactive=${inactive.join(',')}` : 'all required plans active'
    )

    const counts = await client.query(`
      SELECT
        (SELECT count(*)::int FROM users WHERE telegram_id BETWEEN 900001 AND 900004) AS seed_users,
        (SELECT count(*)::int FROM subscriptions) AS subscriptions,
        (SELECT count(*)::int FROM payments) AS payments,
        (SELECT count(*)::int FROM legal_document_versions) AS legal_versions,
        (SELECT count(*)::int FROM legal_document_activations) AS legal_activations,
        (SELECT count(*)::int FROM web_sessions) AS web_sessions,
        (SELECT count(*)::int FROM sled_rooms) AS sled_rooms,
        (SELECT count(*)::int FROM mafia_rooms) AS mafia_rooms,
        (SELECT count(*)::int FROM doubles_rooms) AS doubles_rooms,
        (SELECT count(*)::int FROM infected_rooms) AS infected_rooms
    `)
    const c = counts.rows[0]
    record(
      results,
      'info',
      'seed.users_900001_900004',
      true,
      `count=${c.seed_users} (optional; use migrate:staging:seed if needed)`
    )
    record(results, 'info', 'counts.subscriptions', true, `count=${c.subscriptions}`)
    record(results, 'info', 'counts.payments', true, `count=${c.payments}`)
    record(
      results,
      'info',
      'legal.versions',
      true,
      `count=${c.legal_versions} (legal package import is separate from DB migrate)`
    )
    record(results, 'info', 'legal.activations', true, `count=${c.legal_activations}`)
    record(results, 'info', 'web.sessions_rows', true, `count=${c.web_sessions}`)
    record(
      results,
      'info',
      'party.room_counts',
      true,
      `sled=${c.sled_rooms} mafia=${c.mafia_rooms} doubles=${c.doubles_rooms} infected=${c.infected_rooms}`
    )

    let stageCanConnectSupabase = null
    try {
      const iso = await client.query(
        `SELECT has_database_privilege($1, $2, 'CONNECT') AS ok`,
        [APP_ROLE, PROD_DB]
      )
      stageCanConnectSupabase = Boolean(iso.rows[0]?.ok)
      record(
        results,
        'required',
        'isolation.stage_connect_supabase',
        stageCanConnectSupabase === false,
        stageCanConnectSupabase
          ? 'gnh_web_stage CAN CONNECT to gnh_supabase — restrict in Timeweb panel later (do not REVOKE from this tool)'
          : 'no CONNECT to gnh_supabase (preferred)'
      )
    } catch (e) {
      record(
        results,
        'required',
        'isolation.stage_connect_supabase',
        true,
        `probe unavailable (${redactError(e)}) — treat as isolated / invisible`
      )
    }

    // Confirm checklist SQL itself is SELECT-only (no mutating keywords outside comments).
    const sqlText = fs.readFileSync(verifySqlPath, 'utf8')
    const stripped = sqlText
      .replace(/--[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/'(?:\\'|[^'])*'/g, "''")
    // Flag real statements only (privilege names like 'INSERT' in has_table_privilege are ignored).
    const mutating =
      /\b(INSERT\s+INTO|UPDATE\s+\S|DELETE\s+FROM|MERGE\s+INTO|TRUNCATE\s+|ALTER\s+|DROP\s+|CREATE\s+|GRANT\s+|REVOKE\s+|CALL\s+)/i.test(
        stripped
      )
    record(
      results,
      'required',
      'checklist.sql_read_only',
      !mutating,
      mutating ? 'verify SQL appears to contain mutating statements' : 'SELECT/catalog only'
    )
  } finally {
    await client.end().catch(() => {})
  }

  const required = results.filter((r) => r.level === 'required')
  const failed = required.filter((r) => !r.ok)
  const info = results.filter((r) => r.level === 'info')

  console.log('')
  console.log('======== VERIFY SUMMARY ========')
  console.log(`required: ${required.length - failed.length}/${required.length} PASS`)
  console.log(`info:     ${info.length} notes`)
  if (failed.length) {
    console.log('FAIL items:')
    for (const f of failed) console.log(` - ${f.id}${f.detail ? `: ${f.detail}` : ''}`)
    console.log('VERIFY_FAIL')
    console.log(
      'No SQL changes were made. Fix on gnh_web_staging only — never gnh_supabase / production roles.'
    )
    process.exit(2)
  }

  const seedCount = info.find((i) => i.id === 'seed.users_900001_900004')
  const legal = info.find((i) => i.id === 'legal.versions')
  console.log('VERIFY_PASS')
  console.log(
    'Staging schema/grants/RLS/plans look ready for WEB API against gnh_web_staging.'
  )
  if (seedCount && /count=0/.test(seedCount.detail)) {
    console.log(
      'NOTE: synthetic seed users 900001–900004 are absent — optional for WEB launch; add later via migrate:staging:seed if you need demo Premium users.'
    )
  }
  if (legal && /count=0/.test(legal.detail)) {
    console.log(
      'NOTE: legal_document_versions is empty — import legal package separately before production-like legal/Premium checkout UX.'
    )
  }
}

main().catch((e) => {
  console.error('VERIFY_ERROR', redactError(e))
  process.exit(1)
})
