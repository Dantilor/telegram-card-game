#!/usr/bin/env node
/**
 * Apply ONLY migrations 017 + 018 + grants subset to gnh_web_staging.
 * Does NOT re-run 001–015. Never touches gnh_supabase.
 *
 * Usage (from server/, after `npm run build:api`):
 *   # PowerShell: Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
 *   $env:STAGING_DATABASE_URL='postgresql://gnh_web_migrate:***@HOST:5432/gnh_web_staging?sslmode=verify-full'
 *   $env:STAGING_EXPECT_HOST='HOST'
 *   $env:STAGING_MIGRATE_USER='gnh_web_migrate'
 *   $env:DATABASE_TLS_CA_FILE='C:\path\to\timeweb-ca.crt'
 *   npm run migrate:staging:017:dry
 *   npm run migrate:staging:017:preflight
 *   npm run migrate:staging:017
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(__dirname, '..')
const dryRun = process.argv.includes('--dry-run')
const preflightOnly = process.argv.includes('--preflight')
const checkOnly = process.argv.includes('--check-connection')

const EXPECTED_DB = 'gnh_web_staging'
const APP_ROLE = 'gnh_web_stage'

const steps = [
  { label: '017', file: 'db/migrations/017_web_anonymous_accounts.sql' },
  { label: '018', file: 'db/migrations/018_web_rate_buckets.sql' },
  { label: 'grants-017-018', file: 'db/staging/02_grants_017_018_only.sql' },
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

function resolve(rel) {
  return path.join(serverRoot, rel)
}

function assertIsolation(rawUrl) {
  if ((process.env.DATABASE_URL || '').trim()) {
    die('Refusing: DATABASE_URL is set. Unset it and use only STAGING_DATABASE_URL.')
  }
  if (!rawUrl) die('Set STAGING_DATABASE_URL')
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
    die(`Refusing: do not migrate as ${APP_ROLE}`)
  }
  const expectHost = (process.env.STAGING_EXPECT_HOST || '').trim()
  if (!expectHost) die('STAGING_EXPECT_HOST is required')
  if (host.toLowerCase() !== expectHost.toLowerCase()) {
    die('Refusing: host does not match STAGING_EXPECT_HOST')
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
    die('Missing dist/dbTls.js — run `npm run build:api` in server/ first')
  }
  const mod = await import(pathToFileURL(distPath).href)
  return mod.resolvePgPoolConfig
}

console.log('Target: gnh_web_staging | steps: 017 + 018 + grants-017-018 only')

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
if (resolved.summary.rejectUnauthorized !== true) die('TLS verification was not enabled')
if (resolved.summary.database !== EXPECTED_DB) die('Resolved database is not gnh_web_staging')
if (resolved.summary.user === APP_ROLE) die(`Refusing resolved migrate user ${APP_ROLE}`)

console.log('TLS:', {
  rejectUnauthorized: resolved.summary.rejectUnauthorized,
  servername: resolved.summary.servername,
  caSource: resolved.summary.caSource,
  host: resolved.summary.host,
  database: resolved.summary.database,
  user: resolved.summary.user,
})

if (preflightOnly) {
  console.log('PREFLIGHT_OK (017/018 pack); no connection opened.')
  process.exit(0)
}

const client = new pg.Client(resolved.config)
try {
  await client.connect()
  const id = await client.query('select current_database() as db, current_user as usr')
  const row = id.rows[0]
  if (row.db !== EXPECTED_DB) die(`Connected DB mismatch: ${row.db}`)
  if (row.usr === APP_ROLE) die(`Connected as app role ${APP_ROLE}`)
  console.log('Connected:', { database: row.db, user: row.usr })

  if (checkOnly) {
    for (const rel of [
      'web_accounts',
      'web_entitlements',
      'web_telegram_links',
      'web_telegram_link_challenges',
      'web_email_otps',
      'web_payments',
      'web_rate_buckets',
    ]) {
      const r = await client.query(`select to_regclass($1)::text as reg`, [`public.${rel}`])
      console.log('table', rel, r.rows[0]?.reg ? 'PRESENT' : 'MISSING')
    }
    console.log('CHECK_CONNECTION_OK (read-only probes)')
    process.exit(0)
  }

  // Skip already-applied 017 if web_accounts exists (idempotent CREATE IF NOT EXISTS still OK).
  for (const step of steps) {
    const sql = fs.readFileSync(resolve(step.file), 'utf8')
    await client.query(sql)
    console.log('OK', step.label)
  }
  console.log('DONE 017+018+grants on gnh_web_staging only')
} catch (e) {
  die(`Migrate failed: ${redactError(e)}`)
} finally {
  await client.end().catch(() => {})
}
