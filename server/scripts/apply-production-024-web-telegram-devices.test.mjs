import assert from 'node:assert/strict'
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import {
  STEPS,
  APP_ROLE,
  EXPECTED_DB,
  assertApplyConfirmations,
  assertFilesExist,
  assertProductionTarget,
  chooseMigrateStrategy,
  evaluateMigratePrivileges,
  parseArgs,
  parseDbUrl,
  resolveStepUrl,
} from './apply-production-024-web-telegram-devices.mjs'
import { ALL_STEPS } from './apply-production-web-migrations.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const script = path.join(here, 'apply-production-024-web-telegram-devices.mjs')
const serverRoot = path.join(here, '..')

function run(args, env = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
    cwd: serverRoot,
  })
}

function normSql(s) {
  return s
    .replace(/--.*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
}

test('024 steps are 024a + 024b + focused grants', () => {
  assert.deepEqual(
    STEPS.map((s) => s.label),
    ['024a', '024b', 'grants_web_telegram_devices_gnh_app']
  )
  assert.deepEqual(
    STEPS.map((s) => s.role),
    ['migrate', 'gnh_app', 'devices_owner']
  )
  assertFilesExist(STEPS)
})

test('024 combined equals 024a + 024b DDL bodies', () => {
  const a = fs.readFileSync(path.join(serverRoot, 'db/migrations/024a_web_telegram_devices_table.sql'), 'utf8')
  const b = fs.readFileSync(
    path.join(serverRoot, 'db/migrations/024b_web_telegram_link_challenges_device_cols.sql'),
    'utf8'
  )
  const c = fs.readFileSync(path.join(serverRoot, 'db/migrations/024_web_telegram_devices.sql'), 'utf8')
  assert.match(a, /CREATE TABLE IF NOT EXISTS web_telegram_devices/)
  assert.doesNotMatch(a, /ALTER TABLE web_telegram_link_challenges/)
  assert.match(b, /ALTER TABLE web_telegram_link_challenges/)
  assert.doesNotMatch(b, /CREATE TABLE/)
  assert.equal(normSql(a + '\n' + b), normSql(c))
})

test('legacy through-022/023 migrator never registers 024', () => {
  assert.equal(
    ALL_STEPS.some((s) => s.label === '024' || String(s.file).includes('024_')),
    false
  )
})

test('grants SQL files include web_telegram_devices for gnh_app', () => {
  const mainGrants = fs.readFileSync(
    path.join(serverRoot, 'db/production/grants_web_gnh_app.sql'),
    'utf8'
  )
  const focused = fs.readFileSync(
    path.join(serverRoot, 'db/production/grants_web_telegram_devices_gnh_app.sql'),
    'utf8'
  )
  assert.match(mainGrants, /web_telegram_devices/)
  assert.match(focused, /GRANT[\s\S]*web_telegram_devices[\s\S]*TO\s+gnh_app/i)
  assert.equal(APP_ROLE, 'gnh_app')
  assert.equal(EXPECTED_DB, 'gnh_supabase')
})

test('readonly privilege probe SQL exists and is read-only', () => {
  const sql = fs.readFileSync(
    path.join(serverRoot, 'db/production/preflight_024_privileges_readonly.sql'),
    'utf8'
  )
  assert.match(sql, /READ-ONLY/i)
  assert.doesNotMatch(sql, /^\s*(CREATE|ALTER|GRANT|INSERT|UPDATE|DELETE|DROP)\b/im)
  assert.match(sql, /gnh_app_create_public/)
})

test('parseArgs rejects combined dry-run and preflight', () => {
  assert.throws(() => parseArgs(['node', 'x', '--dry-run', '--preflight']), /only one/)
  assert.deepEqual(parseArgs(['node', 'x', '--dry-run']), {
    dryRun: true,
    preflight: false,
    apply: false,
  })
})

test('apply confirmations require dual-role flag only for dual strategy', () => {
  const base = {
    GNH_ALLOW_PROD_WEB_MIGRATE: '1',
    CONFIRM_PRODUCTION_WEB_MIGRATE: 'YES',
    CONFIRM_PRODUCTION_BACKUP: 'YES',
    CONFIRM_PRODUCTION_024_DEVICES: 'YES',
  }
  assert.doesNotThrow(() => assertApplyConfirmations(base, 'single_current'))
  assert.throws(() => assertApplyConfirmations(base, 'dual_role'), /CONFIRM_PRODUCTION_024_DUAL_ROLE/)
  assert.doesNotThrow(() =>
    assertApplyConfirmations({ ...base, CONFIRM_PRODUCTION_024_DUAL_ROLE: 'YES' }, 'dual_role')
  )
})

test('assertProductionTarget enforces gnh_supabase and rejects staging', () => {
  assert.throws(
    () =>
      assertProductionTarget({
        host: 'db.example',
        user: 'gen_user',
        dbName: 'gnh_web_staging',
      }),
    /gnh_web_staging|Refusing/
  )
  assert.doesNotThrow(() =>
    assertProductionTarget({
      host: 'db.example',
      user: 'gnh_app',
      dbName: 'gnh_supabase',
    })
  )
})

test('chooseMigrateStrategy: observed gen_user blocker becomes dual_role', () => {
  const result = chooseMigrateStrategy({
    migrateUser: 'gen_user',
    canCreateInPublic: true,
    ownsChallenges: false,
    isSuperuser: false,
    gnhAppExists: true,
    gnhAppCanLogin: true,
    gnhAppCanCreateInPublic: false,
    canSelectLinks: true,
    canReferenceAccounts: true,
    challengesOwner: 'gnh_app',
  })
  assert.equal(result.strategy, 'dual_role')
  assert.deepEqual(result.blockers, [])
})

test('chooseMigrateStrategy: gnh_app CREATE prefers single_gnh_app', () => {
  const result = chooseMigrateStrategy({
    migrateUser: 'gen_user',
    canCreateInPublic: true,
    ownsChallenges: false,
    isSuperuser: false,
    gnhAppExists: true,
    gnhAppCanLogin: true,
    gnhAppCanCreateInPublic: true,
    canSelectLinks: true,
    canReferenceAccounts: true,
    challengesOwner: 'gnh_app',
  })
  assert.equal(result.strategy, 'single_gnh_app')
})

test('chooseMigrateStrategy: single_current when connected role owns challenges', () => {
  const result = chooseMigrateStrategy({
    migrateUser: 'gnh_app',
    canCreateInPublic: true,
    ownsChallenges: true,
    isSuperuser: false,
    gnhAppExists: true,
    gnhAppCanLogin: true,
    gnhAppCanCreateInPublic: true,
    canSelectLinks: true,
    canReferenceAccounts: true,
    challengesOwner: 'gnh_app',
  })
  assert.equal(result.strategy, 'single_current')
})

test('evaluateMigratePrivileges ok for dual_role observed production shape', () => {
  const result = evaluateMigratePrivileges({
    migrateUser: 'gen_user',
    canCreateInPublic: true,
    ownsChallenges: false,
    isSuperuser: false,
    gnhAppExists: true,
    challengesOwner: 'gnh_app',
    gnhAppCanLogin: true,
    gnhAppCanCreateInPublic: false,
    canSelectLinks: true,
    canReferenceAccounts: true,
  })
  assert.equal(result.ok, true)
  assert.equal(result.strategy, 'dual_role')
})

test('resolveStepUrl dual_role routes 024b to gnh_app URL', () => {
  const urls = {
    primary: 'postgresql://gen_user:x@h/gnh_supabase?sslmode=verify-full',
    gnhApp: 'postgresql://gnh_app:y@h/gnh_supabase?sslmode=verify-full',
  }
  assert.equal(
    resolveStepUrl('dual_role', STEPS[0], urls, 'gen_user'),
    urls.primary
  )
  assert.equal(resolveStepUrl('dual_role', STEPS[1], urls, 'gen_user'), urls.gnhApp)
  assert.equal(resolveStepUrl('dual_role', STEPS[2], urls, 'gen_user'), urls.primary)
})

test('dry-run lists 024a/024b/grants and never 012-023', () => {
  const result = run(['--dry-run'], {
    PRODUCTION_DATABASE_URL: '',
    DATABASE_URL: '',
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.match(result.stdout, /DRY 024a/)
  assert.match(result.stdout, /DRY 024b/)
  assert.match(result.stdout, /DRY grants_web_telegram_devices_gnh_app/)
  assert.doesNotMatch(result.stdout, /DRY 012|DRY 022|DRY 023/)
})

test('apply without confirmations fails closed', () => {
  const result = run([], {
    PRODUCTION_DATABASE_URL:
      'postgresql://gen_user:x@db.example:5432/gnh_supabase?sslmode=verify-full',
    DATABASE_URL: '',
    GNH_ALLOW_PROD_WEB_MIGRATE: '',
    CONFIRM_PRODUCTION_WEB_MIGRATE: '',
    CONFIRM_PRODUCTION_BACKUP: '',
    CONFIRM_PRODUCTION_024_DEVICES: '',
  })
  assert.notEqual(result.status, 0)
})

test('parseDbUrl extracts production target', () => {
  const info = parseDbUrl(
    'postgresql://gen_user:secret@host.example:5432/gnh_supabase?sslmode=verify-full'
  )
  assert.equal(info.dbName, 'gnh_supabase')
  assert.equal(info.user, 'gen_user')
})

test('024 migrator is not imported by API entrypoints', () => {
  const entryCandidates = [
    path.join(serverRoot, 'src/index.ts'),
    path.join(serverRoot, 'dist/index.js'),
  ]
  for (const p of entryCandidates) {
    if (!fs.existsSync(p)) continue
    const text = fs.readFileSync(p, 'utf8')
    assert.doesNotMatch(text, /apply-production-024|024_web_telegram_devices/)
  }
})