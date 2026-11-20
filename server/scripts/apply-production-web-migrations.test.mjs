import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const here = path.dirname(fileURLToPath(import.meta.url))
const script = path.join(here, 'apply-production-web-migrations.mjs')

function run(args, env = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
    cwd: path.join(here, '..'),
  })
}

test('dry-run without URL lists 012-023 and grants without contacting DB', () => {
  const result = run(['--dry-run'], {
    PRODUCTION_DATABASE_URL: '',
    DATABASE_URL: '',
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.match(result.stdout, /DRY 012/)
  assert.match(result.stdout, /DRY 017/)
  assert.match(result.stdout, /DRY 020/)
  assert.match(result.stdout, /DRY 021/)
  assert.match(result.stdout, /DRY 022/)
  assert.match(result.stdout, /DRY 023/)
  assert.match(result.stdout, /DRY grants_web_gnh_app/)
  assert.match(result.stdout, /No database contacted/)
})

test('apply refuses without backup confirmation', () => {
  const result = run([], {
    PRODUCTION_DATABASE_URL: 'postgresql://migrate:x@db.example:5432/gnh_supabase?sslmode=verify-full',
    GNH_ALLOW_PROD_WEB_MIGRATE: '1',
    CONFIRM_PRODUCTION_WEB_MIGRATE: 'YES',
    CONFIRM_PRODUCTION_BACKUP: '',
    PRODUCTION_EXPECT_HOST: '',
    DATABASE_URL: '',
  })
  assert.notEqual(result.status, 0)
  assert.match(`${result.stdout}\n${result.stderr}`, /CONFIRM_PRODUCTION_BACKUP/)
})

test('refuses staging database name', () => {
  const result = run(['--preflight'], {
    PRODUCTION_DATABASE_URL: 'postgresql://migrate:x@db.example:5432/gnh_web_staging?sslmode=verify-full',
    DATABASE_URL: '',
  })
  assert.notEqual(result.status, 0)
  assert.match(`${result.stdout}\n${result.stderr}`, /gnh_web_staging|Refusing/)
})

test('refuses staging app role in URL', () => {
  const result = run(['--dry-run'], {
    PRODUCTION_DATABASE_URL:
      'postgresql://gnh_web_stage:x@db.example:5432/gnh_supabase?sslmode=verify-full',
    DATABASE_URL: '',
  })
  assert.notEqual(result.status, 0)
  assert.match(`${result.stdout}\n${result.stderr}`, /gnh_web_stage/)
})