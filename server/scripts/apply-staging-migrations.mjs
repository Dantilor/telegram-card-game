#!/usr/bin/env node
/**
 * Apply schema + migrations 001–015 (+ staging grants) to gnh_web_staging only.
 *
 * Usage (from server/, after `npm run build:api`):
 *   npm run migrate:staging:dry
 *   npm run migrate:staging:preflight   # TLS/isolation checks, no SQL
 *   npm run migrate:staging:check-connection  # connect + privilege SELECTs only
 *   unset DATABASE_URL
 *   STAGING_DATABASE_URL=postgresql://CLUSTER_ADMIN:...@HOST/gnh_web_staging?sslmode=verify-full \
 *   STAGING_EXPECT_HOST=HOST \
 *   STAGING_MIGRATE_USER=CLUSTER_ADMIN \
 *   DATABASE_TLS_CA_FILE=/path/to/timeweb-ca.crt \
 *   npm run migrate:staging
 *
 * Prefer existing cluster admin (Timeweb DB owner / root / gen_user) connected ONLY
 * to gnh_web_staging. Never uses production .env DATABASE_URL.
 * Never migrates as gnh_web_stage (app role).
 * Never grants membership in production role gnh_app.
 * TLS via resolvePgPoolConfig (rejectUnauthorized + servername; PGSSLMODE=disable refused).
 * Passwords / full URLs are never logged.
 * --check-connection uses SELECT / privilege metadata only (no CREATE/ALTER/GRANT/REVOKE/migrate/seed).
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import pg from 'pg'
import { evaluateStagingCheckPrivileges } from './stagingCheckPrivileges.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(__dirname, '..')
const wantSeed = process.argv.includes('--seed')
const dryRun = process.argv.includes('--dry-run')
const preflightOnly = process.argv.includes('--preflight')
const checkConnectionOnly = process.argv.includes('--check-connection')

const EXPECTED_DB = 'gnh_web_staging'
const APP_ROLE = 'gnh_web_stage'
const PROD_ROLE = 'gnh_app'

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

const steps = [
  { label: 'schema', file: 'db/schema.sql' },
  { label: '001', file: 'db/migrations/001_payments_new_schema.sql' },
  { label: '002', file: 'db/migrations/002_plans_yookassa.sql' },
  { label: '003-fixed', file: 'db/staging/003_plans_three_tiers_fixed.sql' },
  { label: '004', file: 'db/migrations/004_payments_premium_granted_at.sql' },
  { label: '005', file: 'db/migrations/005_legal_documents.sql' },
  { label: '006', file: 'db/migrations/006_sled_rooms.sql' },
  { label: '007-staging', file: 'db/staging/007_sled_rls_staging.sql' },
  { label: '008', file: 'db/migrations/008_mafia_shadows.sql' },
  { label: '009', file: 'db/migrations/009_doubles.sql' },
  { label: '010', file: 'db/migrations/010_infected.sql' },
  { label: '00-roles-guard', file: 'db/staging/00_roles_optional.sql' },
  { label: '011-staging', file: 'db/staging/011_party_rls_staging.sql' },
  { label: '012', file: 'db/migrations/012_web_sessions.sql' },
  { label: '013', file: 'db/migrations/013_web_session_profile.sql' },
  { label: '014', file: 'db/migrations/014_legal_confirmation_source_web.sql' },
  { label: '015', file: 'db/migrations/015_infected_rooms_code_digits.sql' },
  { label: '017', file: 'db/migrations/017_web_anonymous_accounts.sql' },
  { label: '018', file: 'db/migrations/018_web_rate_buckets.sql' },
  { label: '019', file: 'db/migrations/019_web_legal_subjects.sql' },
  { label: '020', file: 'db/migrations/020_web_email_magic_links.sql' },
  { label: '021', file: 'db/migrations/021_game_session_leases.sql' },
  { label: 'grants-stage', file: 'db/staging/01_grants_gnh_web_stage.sql' },
]

if (wantSeed) {
  steps.push({ label: 'seed', file: 'db/staging/seed_minimal.sql' })
}

function resolve(rel) {
  return path.join(serverRoot, rel)
}

function assertIsolation(rawUrl) {
  if ((process.env.DATABASE_URL || '').trim()) {
    die('Refusing: DATABASE_URL is set. Unset it and use only STAGING_DATABASE_URL.')
  }
  if (!rawUrl) {
    die('Set STAGING_DATABASE_URL (staging migrate URL only)')
  }

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
    die('Refusing to migrate production database gnh_supabase')
  }
  if (dbName !== EXPECTED_DB) {
    die(`Refusing: database must be exactly ${EXPECTED_DB} (got "${dbName}")`)
  }
  if (!host) die('STAGING_DATABASE_URL host is missing')
  if (!user) die('STAGING_DATABASE_URL user is missing')
  if (user === APP_ROLE) {
    die(`Refusing: do not migrate as ${APP_ROLE} (app role). Use a migrate/admin LOGIN for ${EXPECTED_DB} only.`)
  }

  const expectHost = (process.env.STAGING_EXPECT_HOST || '').trim()
  if (!expectHost) {
    die('STAGING_EXPECT_HOST is required (expected Timeweb / local Postgres hostname or IP)')
  }
  if (host.toLowerCase() !== expectHost.toLowerCase()) {
    die(`Refusing: host does not match STAGING_EXPECT_HOST`)
  }

  const expectUser = (process.env.STAGING_MIGRATE_USER || '').trim()
  if (expectUser && user !== expectUser) {
    die('Refusing: migrate user does not match STAGING_MIGRATE_USER')
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
    die('Missing dist/dbTls.js — run `npm run build:api` in server/ before migrating')
  }
  const mod = await import(pathToFileURL(distPath).href)
  return mod.resolvePgPoolConfig
}

function logTlsSummary(summary) {
  console.log('TLS:', {
    rejectUnauthorized: summary.rejectUnauthorized,
    minVersion: summary.minVersion,
    servername: summary.servername,
    checkServerIdentity: summary.checkServerIdentity,
    caSource: summary.caSource,
    host: summary.host,
    port: summary.port,
    database: summary.database,
    user: summary.user,
  })
}

async function applyWithPg(client, filePath, label) {
  const sql = fs.readFileSync(filePath, 'utf8')
  await client.query(sql)
  console.log('OK', label)
}

console.log('Target database:', EXPECTED_DB)
console.log('Driver: node-pg (dbTls verify-full)')

if (dryRun) {
  for (const step of steps) {
    const full = resolve(step.file)
    if (!fs.existsSync(full)) throw new Error(`Missing ${step.file}`)
    console.log('DRY', step.label, step.file)
  }
  process.exit(0)
}

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

if (resolved.summary.rejectUnauthorized !== true) {
  die('TLS verification was not enabled')
}
if (resolved.summary.database !== EXPECTED_DB) {
  die('Resolved database is not gnh_web_staging')
}
if (resolved.summary.user === APP_ROLE) {
  die(`Refusing resolved migrate user ${APP_ROLE}`)
}

logTlsSummary(resolved.summary)

if (preflightOnly) {
  console.log('PREFLIGHT_OK isolation+TLS resolved; no database connection opened.')
  process.exit(0)
}

function listMissingMigrationFiles() {
  const missing = []
  for (const step of steps) {
    if (step.label === 'seed') continue
    if (!fs.existsSync(resolve(step.file))) missing.push(step.file)
  }
  return missing
}

/**
 * Read-only privilege probe for migrate LOGIN against gnh_web_staging.
 * Uses has_*_privilege / pg_roles / pg_auth_members / ownership SELECTs only — never DDL or GRANT.
 */
async function runCheckConnection(client) {
  const identity = await client.query(
    `SELECT current_database() AS db, current_user AS usr, session_user AS session_usr,
            inet_server_addr()::text AS addr`
  )
  const row = identity.rows[0]
  if (row.db !== EXPECTED_DB) {
    die(`Connected database mismatch: expected ${EXPECTED_DB}`)
  }
  if (row.usr === APP_ROLE || row.session_usr === APP_ROLE) {
    die(`Connected as ${APP_ROLE}; refuse check-connection (use migrate admin such as gnh_web_migrate)`)
  }
  if (/gnh_supabase/i.test(row.db)) {
    die('Refusing connected production database')
  }
  console.log('Connected:', {
    database: row.db,
    user: row.usr,
    sessionUser: row.session_usr,
    serverAddrSet: Boolean(row.addr),
  })

  const missingFiles = listMissingMigrationFiles()
  const migrationFilesReady = missingFiles.length === 0
  console.log(
    `CHECK migrations pack schema+001-015+grants-stage: ${migrationFilesReady ? 'ready' : 'incomplete'}`
  )
  if (!migrationFilesReady) {
    for (const file of missingFiles) console.log(` - missing file ${file}`)
  }

  const priv = await client.query(
    `SELECT
       has_database_privilege(current_user, current_database(), 'CONNECT') AS db_connect,
       has_database_privilege(current_user, current_database(), 'CREATE') AS db_create,
       has_schema_privilege(current_user, 'public', 'USAGE') AS schema_usage,
       has_schema_privilege(current_user, 'public', 'CREATE') AS schema_create,
       has_database_privilege(current_user, current_database(), 'CONNECT WITH GRANT OPTION') AS db_connect_grant_option,
       has_schema_privilege(current_user, 'public', 'USAGE WITH GRANT OPTION') AS schema_usage_grant_option,
       (SELECT d.datdba = (SELECT oid FROM pg_roles WHERE rolname = current_user)
          FROM pg_database d WHERE d.datname = current_database()) AS is_db_owner,
       (SELECT n.nspowner = (SELECT oid FROM pg_roles WHERE rolname = current_user)
          FROM pg_namespace n WHERE n.nspname = 'public') AS is_schema_owner`
  )
  const p = priv.rows[0]

  const appRole = await client.query(
    `SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1) AS exists`,
    [APP_ROLE]
  )
  const appExists = Boolean(appRole.rows[0]?.exists)

  let stageMemberOfProd = null
  let isSuper = false
  let hasUsageOnAppRole = false
  let canCreateRole = false
  let appHasDbConnect = null
  let appHasSchemaUsage = null
  if (appExists) {
    const membership = await client.query(
      `SELECT pg_has_role($1, $2, 'member') AS is_member`,
      [APP_ROLE, PROD_ROLE]
    )
    stageMemberOfProd = Boolean(membership.rows[0]?.is_member)

    const appPriv = await client.query(
      `SELECT
         has_database_privilege($1, current_database(), 'CONNECT') AS app_connect,
         has_schema_privilege($1, 'public', 'USAGE') AS app_usage`,
      [APP_ROLE]
    )
    appHasDbConnect = Boolean(appPriv.rows[0]?.app_connect)
    appHasSchemaUsage = Boolean(appPriv.rows[0]?.app_usage)

    // Metadata only — never executes GRANT/ALTER ROLE.
    const grantProbe = await client.query(
      `SELECT
         pg_has_role(current_user, $1, 'USAGE') AS has_usage_on_app,
         (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS is_super,
         (SELECT rolcreaterole FROM pg_roles WHERE rolname = current_user) AS can_create_role`,
      [APP_ROLE]
    )
    const g = grantProbe.rows[0]
    isSuper = Boolean(g.is_super)
    hasUsageOnAppRole = Boolean(g.has_usage_on_app)
    canCreateRole = Boolean(g.can_create_role)
  } else {
    const selfRole = await client.query(
      `SELECT rolsuper, rolcreaterole FROM pg_roles WHERE rolname = current_user`
    )
    isSuper = Boolean(selfRole.rows[0]?.rolsuper)
    canCreateRole = Boolean(selfRole.rows[0]?.rolcreaterole)
  }

  const evaluated = evaluateStagingCheckPrivileges({
    dbConnect: Boolean(p.db_connect),
    dbCreate: Boolean(p.db_create),
    schemaUsage: Boolean(p.schema_usage),
    schemaCreate: Boolean(p.schema_create),
    appRoleExists: appExists,
    appRoleMemberOfProd: stageMemberOfProd,
    isSuper,
    hasUsageOnAppRole,
    canCreateRole,
    appHasDbConnect,
    appHasSchemaUsage,
    migrateIsDbOwner: Boolean(p.is_db_owner),
    migrateCanGrantDbConnect: Boolean(p.db_connect_grant_option),
    migrateIsSchemaOwner: Boolean(p.is_schema_owner),
    migrateCanGrantSchemaUsage: Boolean(p.schema_usage_grant_option),
    migrationFilesReady,
    missingMigrationFiles: missingFiles,
    appRole: APP_ROLE,
    prodRole: PROD_ROLE,
  })

  // Print each privilege on its own line so PowerShell/CI logs stay readable.
  console.log(`CHECK privilege CONNECT database (migrate): ${evaluated.checks.CONNECT}`)
  console.log(`CHECK privilege CREATE database (migrate): ${evaluated.checks.CREATE_database}`)
  console.log(`CHECK privilege USAGE schema public (migrate): ${evaluated.checks.USAGE_public}`)
  console.log(`CHECK privilege CREATE schema public (migrate): ${evaluated.checks.CREATE_public}`)
  console.log(`CHECK app role ${APP_ROLE} exists: ${appExists}`)
  console.log(
    `CHECK isolation ${APP_ROLE} member of ${PROD_ROLE}: ${stageMemberOfProd === null ? 'n/a' : stageMemberOfProd} (expected false)`
  )
  console.log(
    `CHECK ${APP_ROLE} CONNECT on gnh_web_staging: ${appHasDbConnect === null ? 'n/a' : appHasDbConnect} (${evaluated.appRoleGrants.connectStatus})`
  )
  console.log(
    `CHECK ${APP_ROLE} USAGE on schema public: ${appHasSchemaUsage === null ? 'n/a' : appHasSchemaUsage} (${evaluated.appRoleGrants.usageStatus})`
  )
  console.log(
    `CHECK migrate can GRANT CONNECT to ${APP_ROLE}: ${evaluated.appRoleGrants.migrateCanGrantConnect} (db_owner=${Boolean(p.is_db_owner)} grant_option=${Boolean(p.db_connect_grant_option)} super=${isSuper})`
  )
  console.log(
    `CHECK migrate can GRANT USAGE on public to ${APP_ROLE}: ${evaluated.appRoleGrants.migrateCanGrantUsage} (schema_owner=${Boolean(p.is_schema_owner)} grant_option=${Boolean(p.schema_usage_grant_option)} super=${isSuper})`
  )
  console.log(
    `CHECK grant to ${APP_ROLE} on migrate-owned objects: ${evaluated.grantToAppRole.onOwnedObjects}`
  )
  console.log(
    `CHECK grant via CREATEROLE/role USAGE (informational): ${evaluated.grantToAppRole.viaCreateRoleOrRoleUsage}`
  )
  for (const note of evaluated.notes) {
    console.log(`NOTE: ${note}`)
  }

  if (!evaluated.ok) {
    // Use stdout (not stderr) so Windows PowerShell Stop + NativeCommandError cannot hide the list.
    console.log('CHECK_CONNECTION_INCOMPLETE')
    console.log(
      'Report only — no SQL was applied. Needed on gnh_web_staging only (never gnh_supabase / never production role changes / never CREATEROLE):'
    )
    for (const item of evaluated.missing) {
      console.log(' -', item)
    }
    if (evaluated.actions.length) {
      console.log('Actions (gnh_web_staging only):')
      for (const action of evaluated.actions) {
        console.log(' *', action)
      }
    }
    process.exit(2)
  }

  console.log(
    'CHECK_CONNECTION_OK migrate user ready for staging DDL; app CONNECT/USAGE either present or grantable; migrations pack ready.'
  )
}

async function main() {
  const client = new pg.Client({
    connectionString: resolved.connectionString,
    ssl: resolved.ssl,
  })

  try {
    await client.connect()
  } catch (e) {
    console.error('CONNECT_FAILED', redactError(e))
    if (checkConnectionOnly) {
      console.error(
        'Hint: connect to database gnh_web_staging (not postgres). Use migrate admin gen_user. Do not use root if password auth failed.'
      )
    }
    process.exit(1)
  }

  try {
    if (checkConnectionOnly) {
      await runCheckConnection(client)
      return
    }

    const identity = await client.query(
      `SELECT current_database() AS db, current_user AS usr, inet_server_addr()::text AS addr`
    )
    const row = identity.rows[0]
    if (row.db !== EXPECTED_DB) {
      die(`Connected database mismatch: expected ${EXPECTED_DB}`)
    }
    if (row.usr === APP_ROLE) {
      die(`Connected as ${APP_ROLE}; refuse migrations`)
    }
    if (/gnh_supabase/i.test(row.db)) {
      die('Refusing connected production database')
    }
    console.log('Connected:', { database: row.db, user: row.usr, serverAddrSet: Boolean(row.addr) })

    for (const step of steps) {
      const full = resolve(step.file)
      if (!fs.existsSync(full)) {
        console.error('Missing file', step.file)
        process.exit(1)
      }
      try {
        await applyWithPg(client, full, step.label)
      } catch (e) {
        console.error('FAILED', step.label, redactError(e))
        process.exit(1)
      }
    }
    console.log('Staging migrations complete.')
  } finally {
    await client.end().catch(() => {})
  }
}

await main()
