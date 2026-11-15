#!/usr/bin/env node
/**
 * Apply schema + migrations to local database gnh_web_local only.
 *
 * Usage (from server/):
 *   LOCAL_DATABASE_URL=postgresql://gnh_local:...@127.0.0.1:55432/gnh_web_local \
 *   npm run migrate:local
 *   npm run migrate:local:dry
 *   npm run migrate:local -- --seed
 *
 * Refuses gnh_supabase, gnh_web_staging, and Timeweb hostnames.
 * Does not use production DATABASE_URL unless it already targets gnh_web_local
 * and GNH_LOCAL_DATABASE=1 (then LOCAL_DATABASE_URL may be omitted).
 * Passwords / full URLs are never logged.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(serverRoot, '..')
const wantSeed = process.argv.includes('--seed')
const dryRun = process.argv.includes('--dry-run')

const EXPECTED_DB = 'gnh_web_local'

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
  { label: '007-local', file: 'db/local/007_sled_rls_local.sql' },
  { label: '008', file: 'db/migrations/008_mafia_shadows.sql' },
  { label: '009', file: 'db/migrations/009_doubles.sql' },
  { label: '010', file: 'db/migrations/010_infected.sql' },
  { label: '011-local', file: 'db/local/011_party_rls_local.sql' },
  { label: '012', file: 'db/migrations/012_web_sessions.sql' },
  { label: '013', file: 'db/migrations/013_web_session_profile.sql' },
  { label: '014', file: 'db/migrations/014_legal_confirmation_source_web.sql' },
  { label: '015', file: 'db/migrations/015_infected_rooms_code_digits.sql' },
  { label: '016-local-subs', file: 'db/local/016_subscriptions_telegram_unique.sql' },
  { label: '017', file: 'db/migrations/017_web_anonymous_accounts.sql' },
  { label: '018', file: 'db/migrations/018_web_rate_buckets.sql' },
]

if (wantSeed) {
  steps.push({ label: 'seed-e2e', file: path.join('..', 'deploy', 'local', 'seed_e2e.sql') })
}

function resolve(rel) {
  return path.isAbsolute(rel) ? rel : path.join(serverRoot, rel)
}

function assertIsolation(rawUrl) {
  if (!rawUrl) die('Set LOCAL_DATABASE_URL (or DATABASE_URL with GNH_LOCAL_DATABASE=1 targeting gnh_web_local)')

  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch {
    die('LOCAL_DATABASE_URL is not a valid URL')
  }

  const dbName = decodeURIComponent(parsed.pathname.replace(/^\//, ''))
  const user = decodeURIComponent(parsed.username || '')
  const host = parsed.hostname

  if (!dbName || /gnh_supabase/i.test(dbName) || /gnh_supabase/i.test(rawUrl)) {
    die('Refusing production database gnh_supabase')
  }
  if (/gnh_web_staging/i.test(dbName)) {
    die('Refusing Timeweb staging database gnh_web_staging — use migrate:staging for that host after approval')
  }
  if (dbName !== EXPECTED_DB) {
    die(`Refusing: database must be exactly ${EXPECTED_DB} (got "${dbName}")`)
  }
  if (!host) die('host is missing')
  if (!user) die('user is missing')
  if (/\.twc1\.net$/i.test(host) || /timeweb/i.test(host)) {
    die('Refusing Timeweb hostnames for local migrate')
  }
  if (host !== '127.0.0.1' && host !== 'localhost' && host !== '::1') {
    die('Refusing non-loopback host for local migrate')
  }

  return { dbName, user, host }
}

console.log('Target database:', EXPECTED_DB)
console.log('Driver: node-pg (local plaintext loopback)')

if (dryRun) {
  for (const step of steps) {
    const full = resolve(step.file)
    if (!fs.existsSync(full)) throw new Error(`Missing ${step.file}`)
    console.log('DRY', step.label, step.file)
  }
  process.exit(0)
}

const fromLocal = (process.env.LOCAL_DATABASE_URL || '').trim()
const fromDb = (process.env.DATABASE_URL || '').trim()
const localFlag =
  process.env.GNH_LOCAL_DATABASE === '1' || process.env.GNH_LOCAL_DATABASE === 'true'
let stagingUrl = fromLocal
if (!stagingUrl && localFlag && fromDb) {
  stagingUrl = fromDb
}
if (fromDb && !localFlag && !fromLocal) {
  die('Refusing: DATABASE_URL is set without GNH_LOCAL_DATABASE=1. Use LOCAL_DATABASE_URL instead.')
}

const meta = assertIsolation(stagingUrl)
console.log('Connect plan:', { host: meta.host, database: meta.dbName, user: meta.user, ssl: false })

async function main() {
  const client = new pg.Client({
    connectionString: stagingUrl,
    ssl: false,
  })

  try {
    await client.connect()
  } catch (e) {
    console.error('CONNECT_FAILED', redactError(e))
    process.exit(1)
  }

  try {
    const identity = await client.query(
      `SELECT current_database() AS db, current_user AS usr`
    )
    const row = identity.rows[0]
    if (row.db !== EXPECTED_DB) {
      die(`Connected database mismatch: expected ${EXPECTED_DB}`)
    }
    if (/gnh_supabase/i.test(row.db)) {
      die('Refusing connected production database')
    }
    console.log('Connected:', { database: row.db, user: row.usr })

    for (const step of steps) {
      const full = resolve(step.file)
      if (!fs.existsSync(full)) {
        console.error('Missing file', step.file)
        process.exit(1)
      }
      try {
        const sql = fs.readFileSync(full, 'utf8')
        await client.query(sql)
        console.log('OK', step.label)
      } catch (e) {
        console.error('FAILED', step.label, redactError(e))
        process.exit(1)
      }
    }
    console.log('Local migrations complete.')
    console.log('Seed path hint:', path.join(repoRoot, 'deploy', 'local', 'seed_e2e.sql'))
  } finally {
    await client.end().catch(() => {})
  }
}

await main()
