#!/usr/bin/env node
/**
 * Apply ONLY additive WEB migrations 012–014 to existing production DB (gnh_supabase).
 * Does NOT drop/alter payments or subscriptions.
 *
 * Safety gates (all required unless --dry-run):
 *   GNH_ALLOW_PROD_WEB_MIGRATE=1
 *   CONFIRM_PRODUCTION_WEB_MIGRATE=YES
 *   DATABASE_URL / PRODUCTION_DATABASE_URL pointing at gnh_supabase
 *
 * Usage (from server/):
 *   node scripts/apply-production-web-migrations.mjs --dry-run
 *   GNH_ALLOW_PROD_WEB_MIGRATE=1 CONFIRM_PRODUCTION_WEB_MIGRATE=YES \
 *     PRODUCTION_DATABASE_URL='postgres://…/gnh_supabase' \
 *     node scripts/apply-production-web-migrations.mjs
 *
 * Take a DB backup BEFORE running. Do not run from app container start.
 */

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(__dirname, '..')
const dryRun = process.argv.includes('--dry-run')

const databaseUrl = (process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL || '').trim()

const steps = [
  { label: '012', file: 'db/migrations/012_web_sessions.sql' },
  { label: '013', file: 'db/migrations/013_web_session_profile.sql' },
  { label: '014', file: 'db/migrations/014_legal_confirmation_source_web.sql' },
]

function resolve(rel) {
  return path.join(serverRoot, rel)
}

if (dryRun) {
  for (const step of steps) {
    const full = resolve(step.file)
    if (!fs.existsSync(full)) throw new Error(`Missing ${step.file}`)
    console.log('DRY', step.label, step.file)
  }
  console.log('Dry-run OK. No database contacted.')
  process.exit(0)
}

if (process.env.GNH_ALLOW_PROD_WEB_MIGRATE !== '1') {
  console.error('Refusing: set GNH_ALLOW_PROD_WEB_MIGRATE=1 after backup + owner approval')
  process.exit(1)
}
if (process.env.CONFIRM_PRODUCTION_WEB_MIGRATE !== 'YES') {
  console.error('Refusing: set CONFIRM_PRODUCTION_WEB_MIGRATE=YES')
  process.exit(1)
}
if (!databaseUrl) {
  console.error('Set PRODUCTION_DATABASE_URL (preferred) or DATABASE_URL')
  process.exit(1)
}

let dbName = ''
try {
  dbName = new URL(databaseUrl).pathname.replace(/^\//, '').split('/')[0] ?? ''
} catch {
  console.error('DATABASE_URL is not a valid URL')
  process.exit(1)
}

if (dbName !== 'gnh_supabase') {
  console.error(`Refusing: expected database gnh_supabase, got "${dbName}"`)
  process.exit(1)
}

const hasPsql = spawnSync('psql', ['--version'], { encoding: 'utf8' }).status === 0
console.log('Target database:', dbName)
console.log('Driver:', hasPsql ? 'psql' : 'node-pg')

async function applyWithPg(filePath, label) {
  const sql = fs.readFileSync(filePath, 'utf8')
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
  })
  await client.connect()
  try {
    await client.query('BEGIN')
    await client.query(sql)
    await client.query('COMMIT')
    console.log('OK', label)
  } catch (e) {
    try {
      await client.query('ROLLBACK')
    } catch {
      /* ignore */
    }
    throw e
  } finally {
    await client.end()
  }
}

function applyWithPsql(filePath, label) {
  const result = spawnSync(
    'psql',
    [databaseUrl, '-v', 'ON_ERROR_STOP=1', '-1', '-f', filePath],
    { encoding: 'utf8' }
  )
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout)
    throw new Error(`psql failed on ${label}`)
  }
  console.log('OK', label)
}

async function main() {
  for (const step of steps) {
    const full = resolve(step.file)
    try {
      if (hasPsql) applyWithPsql(full, step.label)
      else await applyWithPg(full, step.label)
    } catch (e) {
      console.error('FAILED', step.label, e instanceof Error ? e.message : e)
      process.exit(1)
    }
  }
  console.log('Production WEB migrations 012–014 complete (additive).')
}

await main()
