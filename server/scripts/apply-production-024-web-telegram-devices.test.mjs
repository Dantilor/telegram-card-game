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
  evaluateMigratePrivileges,
  parseArgs,
  parseDbUrl,
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

test('024 steps are exactly migration + focused grants', () => {
  assert.deepEqual(
    STEPS.map((s) => s.label),
    ['024', 'grants_web_telegram_devices_gnh_app']
  )
  assertFilesExist(STEPS)
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

test('parseArgs rejects combined dry-run and preflight', () => {
  assert.throws(() => parseArgs(['node', 'x', '--dry-run', '--preflight']), /only one/)
  assert.deepEqual(parseArgs(['node', 'x', '--dry-run']), {
    dryRun: true,
    preflight: false,
    apply: false,
  })
  assert.deepEqual(parseArgs(['node', 'x']), {
    dryRun: false,
    preflight: false,
    apply: true,
  })
})

test('apply confirmations require backup + explicit 024 flag', () => {
  assert.throws(() => assertApplyConfirmations({}), /GNH_ALLOW_PROD_WEB_MIGRATE/)
  assert.throws(
    () =>
      assertApplyConfirmations({
        GNH_ALLOW_PROD_WEB_MIGRATE: '1',
        CONFIRM_PRODUCTION_WEB_MIGRATE: 'YES',
        CONFIRM_PRODUCTION_BACKUP: 'YES',
      }),
    /CONFIRM_PRODUCTION_024_DEVICES/
  )
  assert.throws(
    () =>
      assertApplyConfirmations({
        GNH_ALLOW_PROD_WEB_MIGRATE: '1',
        CONFIRM_PRODUCTION_WEB_MIGRATE: 'YES',
        CONFIRM_PRODUCTION_024_DEVICES: 'YES',
      }),
    /CONFIRM_PRODUCTION_BACKUP/
  )
  assert.doesNotThrow(() =>
    assertApplyConfirmations({
      GNH_ALLOW_PROD_WEB_MIGRATE: '1',
      CONFIRM_PRODUCTION_WEB_MIGRATE: 'YES',
      CONFIRM_PRODUCTION_BACKUP: 'YES',
      CONFIRM_PRODUCTION_024_DEVICES: 'YES',
    })
  )
})

test('assertProductionTarget enforces gnh_supabase and rejects staging', () => {
  assert.throws(() => assertProductionTarget(null), /PRODUCTION_DATABASE_URL|DATABASE_URL/)
  assert.throws(
    () =>
      assertProductionTarget({
        host: 'db.example',
        user: 'gen_user',
        dbName: 'gnh_web_staging',
      }),
    /gnh_web_staging|Refusing/
  )
  assert.throws(
    () =>
      assertProductionTarget({
        host: 'db.example',
        user: 'gnh_web_stage',
        dbName: 'gnh_supabase',
      }),
    /gnh_web_stage/
  )
  assert.doesNotThrow(() =>
    assertProductionTarget({
      host: 'db.example',
      user: 'gen_user',
      dbName: 'gnh_supabase',
    })
  )
})

test('dry-run lists only 024 steps and never 012-023', () => {
  const result = run(['--dry-run'], {
    PRODUCTION_DATABASE_URL: '',
    DATABASE_URL: '',
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.match(result.stdout, /DRY 024/)
  assert.match(result.stdout, /DRY grants_web_telegram_devices_gnh_app/)
  assert.match(result.stdout, /app_role=gnh_app/)
  assert.doesNotMatch(result.stdout, /DRY 012|DRY 022|DRY 023/)
  assert.match(result.stdout, /012–023/)
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
  assert.match(result.stderr + result.stdout, /GNH_ALLOW_PROD_WEB_MIGRATE|CONFIRM_PRODUCTION/)
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
test('evaluateMigratePrivileges GO when gen_user owns challenges and can CREATE', () => {
  const result = evaluateMigratePrivileges({
    migrateUser: 'gen_user',
    canCreateInPublic: true,
    ownsChallenges: true,
    isSuperuser: false,
    gnhAppExists: true,
    challengesOwner: 'gen_user',
    gnhAppCanLogin: true,
  })
  assert.equal(result.ok, true)
  assert.equal(result.canCreateDevicesTable, true)
  assert.equal(result.canAlterChallenges, true)
  assert.equal(result.canGrantDevicesToGnhApp, true)
  assert.equal(result.gnhAppCanLogin, true)
  assert.deepEqual(result.blockers, [])
})

test('evaluateMigratePrivileges NO-GO without CREATE or challenges ownership', () => {
  const noCreate = evaluateMigratePrivileges({
    migrateUser: 'gen_user',
    canCreateInPublic: false,
    ownsChallenges: true,
    isSuperuser: false,
    gnhAppExists: true,
    challengesOwner: 'gen_user',
    gnhAppCanLogin: true,
  })
  assert.equal(noCreate.ok, false)
  assert.ok(noCreate.blockers.some((b) => /CREATE on schema public/i.test(b)))

  const noOwner = evaluateMigratePrivileges({
    migrateUser: 'gen_user',
    canCreateInPublic: true,
    ownsChallenges: false,
    isSuperuser: false,
    gnhAppExists: true,
    challengesOwner: 'other_owner',
    gnhAppCanLogin: false,
  })
  assert.equal(noOwner.ok, false)
  assert.ok(noOwner.blockers.some((b) => /ALTER web_telegram_link_challenges/i.test(b)))
})

test('evaluateMigratePrivileges allows superuser even without ownership flags', () => {
  const result = evaluateMigratePrivileges({
    migrateUser: 'gen_user',
    canCreateInPublic: false,
    ownsChallenges: false,
    isSuperuser: true,
    gnhAppExists: true,
    challengesOwner: 'someone_else',
    gnhAppCanLogin: true,
  })
  assert.equal(result.ok, true)
})
