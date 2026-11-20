import assert from 'node:assert/strict'
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import {
  ALL_STEPS,
  DEACTIVATE_WEB_PLANS_SQL,
  assertApplyConfirmations,
  parseMigrationPhase,
  rollbackApiRequiresWebPlansDeactivated,
  selectStepsForPhase,
} from './apply-production-web-migrations.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const script = path.join(here, 'apply-production-web-migrations.mjs')
const serverRoot = path.join(here, '..')

function run(args, env = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
    cwd: serverRoot,
  })
}

test('selectStepsForPhase through-022 never includes 023 and keeps grants', () => {
  const steps = selectStepsForPhase('through-022')
  assert.ok(steps.some((s) => s.label === '022'))
  assert.ok(steps.some((s) => s.label === 'grants_web_gnh_app'))
  assert.equal(
    steps.some((s) => s.label === '023'),
    false,
    'Phase A must never select 023'
  )
})

test('selectStepsForPhase activate-023 is exactly 023', () => {
  const steps = selectStepsForPhase('activate-023')
  assert.deepEqual(
    steps.map((s) => s.label),
    ['023']
  )
})

test('parseMigrationPhase defaults to through-022 and rejects both flags', () => {
  assert.equal(parseMigrationPhase(['node', 'script.mjs']), 'through-022')
  assert.equal(parseMigrationPhase(['node', 'script.mjs', '--through-022']), 'through-022')
  assert.equal(parseMigrationPhase(['node', 'script.mjs', '--activate-023']), 'activate-023')
  assert.throws(
    () => parseMigrationPhase(['node', 'script.mjs', '--through-022', '--activate-023']),
    /only one/
  )
})

test('Phase A apply confirmations do not require WEB plans activate flag', () => {
  assert.doesNotThrow(() =>
    assertApplyConfirmations(
      {
        GNH_ALLOW_PROD_WEB_MIGRATE: '1',
        CONFIRM_PRODUCTION_WEB_MIGRATE: 'YES',
        CONFIRM_PRODUCTION_BACKUP: 'YES',
      },
      'through-022'
    )
  )
})

test('Phase B refuses without CONFIRM_PRODUCTION_WEB_PLANS_ACTIVATE', () => {
  assert.throws(
    () =>
      assertApplyConfirmations(
        {
          GNH_ALLOW_PROD_WEB_MIGRATE: '1',
          CONFIRM_PRODUCTION_WEB_MIGRATE: 'YES',
          CONFIRM_PRODUCTION_BACKUP: 'YES',
        },
        'activate-023'
      ),
    /CONFIRM_PRODUCTION_WEB_PLANS_ACTIVATE/
  )
  assert.doesNotThrow(() =>
    assertApplyConfirmations(
      {
        GNH_ALLOW_PROD_WEB_MIGRATE: '1',
        CONFIRM_PRODUCTION_WEB_MIGRATE: 'YES',
        CONFIRM_PRODUCTION_BACKUP: 'YES',
        CONFIRM_PRODUCTION_WEB_PLANS_ACTIVATE: 'YES',
      },
      'activate-023'
    )
  )
})

test('dry-run --through-022 lists Phase A only and never 023', () => {
  const result = run(['--dry-run', '--through-022'], {
    PRODUCTION_DATABASE_URL: '',
    DATABASE_URL: '',
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.match(result.stdout, /phase=through-022/)
  assert.match(result.stdout, /DRY 012/)
  assert.match(result.stdout, /DRY 022/)
  assert.match(result.stdout, /DRY grants_web_gnh_app/)
  assert.doesNotMatch(result.stdout, /DRY 023/)
  assert.match(result.stdout, /023 excluded/)
  assert.match(result.stdout, /No database contacted/)
})

test('default dry-run is Phase A and excludes 023', () => {
  const result = run(['--dry-run'], {
    PRODUCTION_DATABASE_URL: '',
    DATABASE_URL: '',
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.match(result.stdout, /phase=through-022/)
  assert.doesNotMatch(result.stdout, /DRY 023/)
})

test('dry-run --activate-023 lists only 023', () => {
  const result = run(['--dry-run', '--activate-023'], {
    PRODUCTION_DATABASE_URL: '',
    DATABASE_URL: '',
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.match(result.stdout, /phase=activate-023/)
  assert.match(result.stdout, /DRY 023/)
  assert.doesNotMatch(result.stdout, /DRY 022/)
  assert.doesNotMatch(result.stdout, /DRY grants_web_gnh_app/)
})

test('default apply refuses without backup confirmation', () => {
  const result = run(['--through-022'], {
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

test('activate-023 CLI refuses without WEB plans activate confirmation', () => {
  const result = run(['--activate-023'], {
    PRODUCTION_DATABASE_URL: 'postgresql://migrate:x@db.example:5432/gnh_supabase?sslmode=verify-full',
    GNH_ALLOW_PROD_WEB_MIGRATE: '1',
    CONFIRM_PRODUCTION_WEB_MIGRATE: 'YES',
    CONFIRM_PRODUCTION_BACKUP: 'YES',
    CONFIRM_PRODUCTION_WEB_PLANS_ACTIVATE: '',
    PRODUCTION_EXPECT_HOST: '',
    DATABASE_URL: '',
  })
  assert.notEqual(result.status, 0)
  assert.match(`${result.stdout}\n${result.stderr}`, /CONFIRM_PRODUCTION_WEB_PLANS_ACTIVATE/)
})

test('refuses staging database name', () => {
  const result = run(['--preflight', '--through-022'], {
    PRODUCTION_DATABASE_URL: 'postgresql://migrate:x@db.example:5432/gnh_web_staging?sslmode=verify-full',
    DATABASE_URL: '',
  })
  assert.notEqual(result.status, 0)
  assert.match(`${result.stdout}\n${result.stderr}`, /gnh_web_staging|Refusing/)
})

test('refuses staging app role in URL', () => {
  const result = run(['--dry-run', '--through-022'], {
    PRODUCTION_DATABASE_URL:
      'postgresql://gnh_web_stage:x@db.example:5432/gnh_supabase?sslmode=verify-full',
    DATABASE_URL: '',
  })
  assert.notEqual(result.status, 0)
  assert.match(`${result.stdout}\n${result.stderr}`, /gnh_web_stage/)
})

test('022 SQL keeps Telegram prices and inserts WEB plans inactive', () => {
  const sql = fs.readFileSync(path.join(serverRoot, 'db/migrations/022_web_plans_audience.sql'), 'utf8')
  assert.match(sql, /premium_web_1m[\s\S]*false,\s*'web'/)
  assert.match(sql, /premium_web_3m[\s\S]*false,\s*'web'/)
  assert.match(sql, /premium_web_lifetime[\s\S]*false,\s*'web'/)
  assert.match(sql, /Does NOT change existing premium_1m/)
  assert.match(sql, /audience = 'telegram'/)
  assert.match(sql, /plan_id IN \('premium_1m', 'premium_3m', 'premium_lifetime'\)/)
  // Must not activate rows in 022 (partial index predicate is fine)
  assert.doesNotMatch(sql, /is_active\s*=\s*true(?!\s*;)/)
  assert.doesNotMatch(sql, /UPDATE\s+plans[\s\S]{0,120}price_rub\s*=/i)
  assert.match(sql, /,\s*false,\s*'web'/)
})

test('023 SQL activates only WEB plan ids at expected prices', () => {
  const sql = fs.readFileSync(path.join(serverRoot, 'db/migrations/023_web_plans_activate.sql'), 'utf8')
  assert.match(sql, /is_active = true/)
  assert.match(sql, /premium_web_1m[\s\S]*259|WHEN 'premium_web_1m' THEN 259/)
  assert.match(sql, /WHEN 'premium_web_3m' THEN 499/)
  assert.match(sql, /WHEN 'premium_web_lifetime' THEN 1190/)
  assert.doesNotMatch(sql, /premium_1m'|premium_3m'|premium_lifetime'/)
})

test('ALL_STEPS files exist and Phase markers are exclusive', () => {
  for (const step of ALL_STEPS) {
    assert.ok(fs.existsSync(path.join(serverRoot, step.file)), step.file)
    assert.ok(step.phase === 'through-022' || step.phase === 'activate-023')
  }
  assert.equal(ALL_STEPS.filter((s) => s.label === '023').length, 1)
  assert.equal(ALL_STEPS.find((s) => s.label === '023')?.phase, 'activate-023')
})

test('API rollback after 023 requires WEB plan deactivation first', () => {
  const guide = rollbackApiRequiresWebPlansDeactivated()
  assert.equal(guide.required, true)
  assert.equal(guide.beforeApiRollbackTo, 'ac49d0c')
  assert.equal(guide.sql, DEACTIVATE_WEB_PLANS_SQL)
  assert.match(guide.sql, /is_active = false/)
  assert.match(guide.sql, /audience = 'web'/)
  assert.match(guide.reason, /Telegram/)
})
