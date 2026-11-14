import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const here = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(here, '..')
const script = path.join(here, 'apply-staging-migrations.mjs')

function run(env, args = []) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: serverRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      DATABASE_URL: undefined,
      STAGING_DATABASE_URL: undefined,
      STAGING_EXPECT_HOST: undefined,
      GNH_EXPECT_HOST: undefined,
      PGSSLMODE: undefined,
      NODE_TLS_REJECT_UNAUTHORIZED: undefined,
      ...env,
    },
  })
}

test('dry-run lists schema through grants without connecting', () => {
  const result = run({}, ['--dry-run'])
  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.match(result.stdout, /DRY schema/)
  assert.match(result.stdout, /DRY 007-staging/)
  assert.match(result.stdout, /DRY 011-staging/)
  assert.match(result.stdout, /DRY 014/)
  assert.match(result.stdout, /DRY 015/)
  assert.match(result.stdout, /DRY grants-stage/)
  assert.equal(/postgres(?:ql)?:\/\/\S+/i.test(result.stdout + result.stderr), false)
  assert.equal(/GRANT\s+gnh_app\s+TO/i.test(result.stdout + result.stderr), false)
})

test('preflight refuses app role gnh_web_stage before connect', () => {
  const result = run({
    STAGING_DATABASE_URL: 'postgresql://gnh_web_stage:x@db.example:5432/gnh_web_staging?sslmode=verify-full',
    STAGING_EXPECT_HOST: 'db.example',
    STAGING_MIGRATE_USER: 'gnh_web_stage',
  }, ['--preflight'])
  assert.notEqual(result.status, 0)
  assert.match(`${result.stdout}\n${result.stderr}`, /gnh_web_stage/)
  assert.equal(/postgresql:\/\/gnh_web_stage:x@/i.test(result.stdout + result.stderr), false)
})

test('check-connection refuses app role before connect', () => {
  const result = run({
    STAGING_DATABASE_URL: 'postgresql://gnh_web_stage:x@db.example:5432/gnh_web_staging?sslmode=verify-full',
    STAGING_EXPECT_HOST: 'db.example',
    STAGING_MIGRATE_USER: 'gnh_web_stage',
  }, ['--check-connection'])
  assert.notEqual(result.status, 0)
  assert.match(`${result.stdout}\n${result.stderr}`, /gnh_web_stage/)
  assert.equal(/postgresql:\/\/gnh_web_stage:x@/i.test(result.stdout + result.stderr), false)
})

test('check-connection refuses production database name', () => {
  const result = run({
    STAGING_DATABASE_URL: 'postgresql://gen_user:x@db.example:5432/gnh_supabase?sslmode=verify-full',
    STAGING_EXPECT_HOST: 'db.example',
    STAGING_MIGRATE_USER: 'gen_user',
  }, ['--check-connection'])
  assert.notEqual(result.status, 0)
  assert.match(`${result.stdout}\n${result.stderr}`, /gnh_supabase/)
})

test('preflight refuses production database name', () => {
  const result = run({
    STAGING_DATABASE_URL: 'postgresql://root:x@db.example:5432/gnh_supabase?sslmode=verify-full',
    STAGING_EXPECT_HOST: 'db.example',
    STAGING_MIGRATE_USER: 'root',
  }, ['--preflight'])
  assert.notEqual(result.status, 0)
  assert.match(`${result.stdout}\n${result.stderr}`, /gnh_supabase/)
})

test('refuses production database name in STAGING_DATABASE_URL', () => {
  const result = run({
    STAGING_DATABASE_URL: 'postgresql://migrate:x@db.example:5432/gnh_supabase',
    STAGING_EXPECT_HOST: 'db.example',
  })
  assert.notEqual(result.status, 0)
  assert.match(`${result.stdout}\n${result.stderr}`, /gnh_supabase/)
})

test('refuses wrong staging database name', () => {
  const result = run({
    STAGING_DATABASE_URL: 'postgresql://migrate:x@db.example:5432/other_db',
    STAGING_EXPECT_HOST: 'db.example',
  })
  assert.notEqual(result.status, 0)
  assert.match(`${result.stdout}\n${result.stderr}`, /gnh_web_staging/)
})

test('refuses when DATABASE_URL from production env is present', () => {
  const result = run({
    DATABASE_URL: 'postgresql://prod:x@db.example:5432/gnh_supabase',
    STAGING_DATABASE_URL: 'postgresql://migrate:x@db.example:5432/gnh_web_staging',
    STAGING_EXPECT_HOST: 'db.example',
  })
  assert.notEqual(result.status, 0)
  assert.match(`${result.stdout}\n${result.stderr}`, /DATABASE_URL is set/)
})

test('refuses PGSSLMODE=disable', () => {
  const result = run({
    STAGING_DATABASE_URL: 'postgresql://migrate:x@db.example:5432/gnh_web_staging',
    STAGING_EXPECT_HOST: 'db.example',
    PGSSLMODE: 'disable',
  })
  assert.notEqual(result.status, 0)
  assert.match(`${result.stdout}\n${result.stderr}`, /PGSSLMODE/)
})

test('refuses migrate as gnh_web_stage app role', () => {
  const result = run({
    STAGING_DATABASE_URL: 'postgresql://gnh_web_stage:x@db.example:5432/gnh_web_staging',
    STAGING_EXPECT_HOST: 'db.example',
  })
  assert.notEqual(result.status, 0)
  assert.match(`${result.stdout}\n${result.stderr}`, /gnh_web_stage/)
})

test('refuses host mismatch', () => {
  const result = run({
    STAGING_DATABASE_URL: 'postgresql://migrate:x@db.example:5432/gnh_web_staging',
    STAGING_EXPECT_HOST: 'other.example',
  })
  assert.notEqual(result.status, 0)
  assert.match(`${result.stdout}\n${result.stderr}`, /STAGING_EXPECT_HOST/)
})
