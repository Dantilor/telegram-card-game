import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const here = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(here, '..')
const repoRoot = path.resolve(serverRoot, '..')
const script = path.join(here, 'verify-staging.mjs')
const sqlPath = path.join(repoRoot, 'deploy', 'stand', 'verify-gnh-web-staging.sql')

function run(env) {
  return spawnSync(process.execPath, [script], {
    cwd: serverRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      DATABASE_URL: undefined,
      STAGING_DATABASE_URL: undefined,
      STAGING_EXPECT_HOST: undefined,
      STAGING_MIGRATE_USER: undefined,
      PGSSLMODE: undefined,
      ...env,
    },
  })
}

test('verify SQL checklist exists and is SELECT-only', () => {
  assert.equal(fs.existsSync(sqlPath), true)
  const text = fs.readFileSync(sqlPath, 'utf8')
  const stripped = text
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/'(?:\\'|[^'])*'/g, "''")
  assert.equal(
    /\b(INSERT\s+INTO|UPDATE\s+\S|DELETE\s+FROM|ALTER\s+|DROP\s+|CREATE\s+|GRANT\s+|REVOKE\s+)/i.test(stripped),
    false
  )
  assert.match(text, /infected_rooms_code_format/)
  assert.match(text, /has_table_privilege\('gnh_web_stage'/)
  assert.match(text, /gnh_supabase/)
})

test('verify refuses production database name', () => {
  const result = run({
    STAGING_DATABASE_URL: 'postgresql://gnh_web_migrate:x@db.example:5432/gnh_supabase?sslmode=verify-full',
    STAGING_EXPECT_HOST: 'db.example',
    STAGING_MIGRATE_USER: 'gnh_web_migrate',
  })
  assert.notEqual(result.status, 0)
  assert.match(`${result.stdout}\n${result.stderr}`, /gnh_supabase/)
})

test('verify refuses app role', () => {
  const result = run({
    STAGING_DATABASE_URL: 'postgresql://gnh_web_stage:x@db.example:5432/gnh_web_staging?sslmode=verify-full',
    STAGING_EXPECT_HOST: 'db.example',
    STAGING_MIGRATE_USER: 'gnh_web_stage',
  })
  assert.notEqual(result.status, 0)
  assert.match(`${result.stdout}\n${result.stderr}`, /gnh_web_stage/)
})

test('verify refuses DATABASE_URL bleed', () => {
  const result = run({
    DATABASE_URL: 'postgresql://prod:x@db.example:5432/gnh_supabase',
    STAGING_DATABASE_URL: 'postgresql://gnh_web_migrate:x@db.example:5432/gnh_web_staging?sslmode=verify-full',
    STAGING_EXPECT_HOST: 'db.example',
    STAGING_MIGRATE_USER: 'gnh_web_migrate',
  })
  assert.notEqual(result.status, 0)
  assert.match(`${result.stdout}\n${result.stderr}`, /DATABASE_URL is set/)
})
