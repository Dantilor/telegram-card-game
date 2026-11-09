#!/usr/bin/env node
/**
 * Apply schema + migrations 001–014 (+ staging grants) to gnh_web_staging only.
 *
 * Usage (from server/, after `npm run build:api`):
 *   npm run migrate:staging:dry
 *   unset DATABASE_URL
 *   STAGING_DATABASE_URL=postgresql://CLUSTER_ADMIN:...@HOST/gnh_web_staging?sslmode=verify-full \
 *   STAGING_EXPECT_HOST=HOST \
 *   STAGING_MIGRATE_USER=CLUSTER_ADMIN \
 *   DATABASE_TLS_CA_FILE=/path/to/timeweb-ca.crt \
 *   npm run migrate:staging
 *
 * Prefer existing cluster admin connected ONLY to gnh_web_staging.
 * Never uses production .env DATABASE_URL.
 * Never migrates as gnh_web_stage (app role).
 * Never grants membership in production role gnh_app.
 * TLS via resolvePgPoolConfig (rejectUnauthorized + servername; PGSSLMODE=disable refused).
 * Passwords / full URLs are never logged.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(__dirname, '..')
const wantSeed = process.argv.includes('--seed')
const dryRun = process.argv.includes('--dry-run')

const EXPECTED_DB = 'gnh_web_staging'
const APP_ROLE = 'gnh_web_stage'

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

async function main() {
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

  try {
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
