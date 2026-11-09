#!/usr/bin/env node
/**
 * Apply schema + migrations 001–014 to a STAGING PostgreSQL database.
 * Refuses production database name gnh_supabase.
 *
 * Usage (from server/):
 *   node scripts/apply-staging-migrations.mjs
 *   STAGING_DATABASE_URL=postgres://... node scripts/apply-staging-migrations.mjs --seed
 *
 * Requires: DATABASE_URL or STAGING_DATABASE_URL, and `psql` on PATH,
 * or falls back to node-pg when psql is unavailable.
 */

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(__dirname, '..')
const wantSeed = process.argv.includes('--seed')
const dryRun = process.argv.includes('--dry-run')

const databaseUrl = (process.env.STAGING_DATABASE_URL || process.env.DATABASE_URL || '').trim()

let dbName = ''
if (databaseUrl) {
  try {
    dbName = new URL(databaseUrl).pathname.replace(/^\//, '')
  } catch {
    console.error('DATABASE_URL is not a valid URL')
    process.exit(1)
  }
  if (/gnh_supabase/i.test(dbName) || /gnh_supabase/i.test(databaseUrl)) {
    console.error('Refusing to migrate production database gnh_supabase')
    process.exit(1)
  }
} else if (!dryRun) {
  console.error('Set STAGING_DATABASE_URL (preferred) or DATABASE_URL')
  process.exit(1)
}

const steps = [
  { label: 'schema', file: 'db/schema.sql' },
  { label: '001', file: 'db/migrations/001_payments_new_schema.sql' },
  { label: '002', file: 'db/migrations/002_plans_yookassa.sql' },
  { label: '003-fixed', file: 'db/staging/003_plans_three_tiers_fixed.sql' },
  { label: '004', file: 'db/migrations/004_payments_premium_granted_at.sql' },
  { label: '005', file: 'db/migrations/005_legal_documents.sql' },
  { label: '006', file: 'db/migrations/006_sled_rooms.sql' },
  { label: '007', file: 'db/migrations/007_sled_rls.sql' },
  { label: '008', file: 'db/migrations/008_mafia_shadows.sql' },
  { label: '009', file: 'db/migrations/009_doubles.sql' },
  { label: '010', file: 'db/migrations/010_infected.sql' },
  { label: '00-roles', file: 'db/staging/00_roles_optional.sql' },
  { label: '011', file: 'db/migrations/011_party_app_grants.sql' },
  { label: '012', file: 'db/migrations/012_web_sessions.sql' },
  { label: '013', file: 'db/migrations/013_web_session_profile.sql' },
  { label: '014', file: 'db/migrations/014_legal_confirmation_source_web.sql' },
]

if (wantSeed) {
  steps.push({ label: 'seed', file: 'db/staging/seed_minimal.sql' })
}

function resolve(rel) {
  return path.join(serverRoot, rel)
}

async function applyWithPg(filePath, label) {
  const sql = fs.readFileSync(filePath, 'utf8')
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
  })
  await client.connect()
  try {
    await client.query(sql)
    console.log('OK', label)
  } finally {
    await client.end()
  }
}

function applyWithPsql(filePath, label) {
  const result = spawnSync(
    'psql',
    [databaseUrl, '-v', 'ON_ERROR_STOP=1', '-f', filePath],
    { encoding: 'utf8' }
  )
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout)
    throw new Error(`psql failed on ${label}`)
  }
  console.log('OK', label)
}

const hasPsql = spawnSync('psql', ['--version'], { encoding: 'utf8' }).status === 0

console.log('Target database:', dbName || '(dry-run / unset)')
console.log('Driver:', hasPsql ? 'psql' : 'node-pg')
if (dryRun) {
  for (const step of steps) {
    const full = resolve(step.file)
    if (!fs.existsSync(full)) throw new Error(`Missing ${step.file}`)
    console.log('DRY', step.label, step.file)
  }
  process.exit(0)
}

async function main() {
  for (const step of steps) {
    const full = resolve(step.file)
    if (!fs.existsSync(full)) {
      console.error('Missing file', step.file)
      process.exit(1)
    }
    try {
      if (hasPsql) applyWithPsql(full, step.label)
      else await applyWithPg(full, step.label)
    } catch (e) {
      console.error('FAILED', step.label, e instanceof Error ? e.message : e)
      process.exit(1)
    }
  }
  console.log('Staging migrations complete.')
}

await main()
