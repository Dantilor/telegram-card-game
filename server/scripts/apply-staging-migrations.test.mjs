import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { evaluateStagingCheckPrivileges } from './stagingCheckPrivileges.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(here, '..')
const script = path.join(here, 'apply-staging-migrations.mjs')
const script017 = path.join(here, 'apply-staging-017.mjs')
const script019 = path.join(here, 'apply-staging-019.mjs')

function run(env, args = [], target = script) {
  return spawnSync(process.execPath, [target, ...args], {
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
  assert.match(result.stdout, /DRY 017/)
  assert.match(result.stdout, /DRY 018/)
  assert.match(result.stdout, /DRY 019/)
  assert.match(result.stdout, /DRY 020/)
  assert.match(result.stdout, /DRY 021/)
  assert.match(result.stdout, /DRY grants-stage/)
  assert.equal(/postgres(?:ql)?:\/\/\S+/i.test(result.stdout + result.stderr), false)
  assert.equal(/GRANT\s+gnh_app\s+TO/i.test(result.stdout + result.stderr), false)
})

test('017-only dry-run lists 017+018+grants and mentions single transaction', () => {
  const result = run({}, ['--dry-run'], script017)
  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.match(result.stdout, /single transaction/i)
  assert.match(result.stdout, /DRY 017/)
  assert.match(result.stdout, /DRY 018/)
  assert.match(result.stdout, /DRY 019/)
  assert.match(result.stdout, /DRY 020/)
  assert.match(result.stdout, /DRY 021/)
  assert.match(result.stdout, /DRY grants-017-018/)
  assert.equal(/DRY schema/.test(result.stdout), false)
  assert.equal(/postgres(?:ql)?:\/\/\S+/i.test(result.stdout + result.stderr), false)
})

test('019-only dry-run lists 019 + grants-019 and never 017/018', () => {
  const result = run({}, ['--dry-run'], script019)
  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.match(result.stdout, /019 pack only|019 \+ grants-019/i)
  assert.match(result.stdout, /DRY 019_web_legal_subjects/)
  assert.match(result.stdout, /DRY grants_019_only/)
  assert.equal(/DRY 017/.test(result.stdout), false)
  assert.equal(/DRY 018/.test(result.stdout), false)
  assert.equal(/DRY schema/.test(result.stdout), false)
  assert.equal(/postgres(?:ql)?:\/\/\S+/i.test(result.stdout + result.stderr), false)
})

test('019-only preflight refuses app role and production DB name', () => {
  const appRole = run(
    {
      STAGING_DATABASE_URL:
        'postgresql://gnh_web_stage:x@db.example:5432/gnh_web_staging?sslmode=verify-full',
      STAGING_EXPECT_HOST: 'db.example',
      STAGING_MIGRATE_USER: 'gnh_web_stage',
    },
    ['--preflight'],
    script019
  )
  assert.notEqual(appRole.status, 0)
  assert.match(`${appRole.stdout}\n${appRole.stderr}`, /gnh_web_stage|Refusing/i)

  const prodDb = run(
    {
      STAGING_DATABASE_URL:
        'postgresql://migrate:x@db.example:5432/gnh_supabase?sslmode=verify-full',
      STAGING_EXPECT_HOST: 'db.example',
    },
    ['--preflight'],
    script019
  )
  assert.notEqual(prodDb.status, 0)
  assert.match(`${prodDb.stdout}\n${prodDb.stderr}`, /gnh_supabase|Refusing/i)
})

test('017-only preflight refuses app role before connect', () => {
  const result = run(
    {
      STAGING_DATABASE_URL:
        'postgresql://gnh_web_stage:x@db.example:5432/gnh_web_staging?sslmode=verify-full',
      STAGING_EXPECT_HOST: 'db.example',
      STAGING_MIGRATE_USER: 'gnh_web_stage',
    },
    ['--preflight'],
    script017
  )
  assert.notEqual(result.status, 0)
  assert.match(`${result.stdout}\n${result.stderr}`, /gnh_web_stage|Refusing/i)
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

test('evaluateStagingCheckPrivileges: missing CREATEROLE is not a hard fail when CREATE schema is present', () => {
  const result = evaluateStagingCheckPrivileges({
    dbConnect: true,
    dbCreate: true,
    schemaUsage: true,
    schemaCreate: true,
    appRoleExists: true,
    appRoleMemberOfProd: false,
    isSuper: false,
    hasUsageOnAppRole: false,
    canCreateRole: false,
  })
  assert.equal(result.ok, true)
  assert.equal(result.grantToAppRole.onOwnedObjects, true)
  assert.equal(result.grantToAppRole.viaCreateRoleOrRoleUsage, false)
  assert.equal(result.missing.length, 0)
  assert.ok(result.notes.some((n) => /CREATEROLE/i.test(n)))
})

test('evaluateStagingCheckPrivileges: reports CONNECT/CREATE/USAGE/CREATE separately as missing', () => {
  const result = evaluateStagingCheckPrivileges({
    dbConnect: true,
    dbCreate: false,
    schemaUsage: false,
    schemaCreate: false,
    appRoleExists: true,
    appRoleMemberOfProd: false,
    isSuper: false,
    hasUsageOnAppRole: false,
    canCreateRole: false,
    appHasDbConnect: true,
    appHasSchemaUsage: true,
    migrateIsDbOwner: false,
    migrateCanGrantDbConnect: false,
    migrateIsSchemaOwner: false,
    migrateCanGrantSchemaUsage: false,
    migrationFilesReady: true,
  })
  assert.equal(result.ok, false)
  assert.equal(result.checks.CONNECT, true)
  assert.equal(result.checks.CREATE_database, false)
  assert.equal(result.checks.USAGE_public, false)
  assert.equal(result.checks.CREATE_public, false)
  assert.ok(result.missing.some((m) => /CREATE on database/.test(m)))
  assert.ok(result.missing.some((m) => /USAGE on schema public/.test(m)))
  assert.ok(result.missing.some((m) => /CREATE on schema public/.test(m)))
  assert.equal(result.missing.some((m) => /CREATEROLE/i.test(m)), false)
})

test('evaluateStagingCheckPrivileges: app CONNECT/USAGE already present skips grant ability requirement', () => {
  const result = evaluateStagingCheckPrivileges({
    dbConnect: true,
    dbCreate: true,
    schemaUsage: true,
    schemaCreate: true,
    appRoleExists: true,
    appRoleMemberOfProd: false,
    isSuper: false,
    hasUsageOnAppRole: false,
    canCreateRole: false,
    appHasDbConnect: true,
    appHasSchemaUsage: true,
    migrateIsDbOwner: false,
    migrateCanGrantDbConnect: false,
    migrateIsSchemaOwner: false,
    migrateCanGrantSchemaUsage: false,
    migrationFilesReady: true,
  })
  assert.equal(result.ok, true)
  assert.equal(result.appRoleGrants.connectStatus, 'already_present_skip_grant')
  assert.equal(result.appRoleGrants.usageStatus, 'already_present_skip_grant')
  assert.equal(result.appRoleGrants.migrateCanGrantConnect, false)
})

test('evaluateStagingCheckPrivileges: missing app CONNECT without grant ability is hard fail', () => {
  const result = evaluateStagingCheckPrivileges({
    dbConnect: true,
    dbCreate: true,
    schemaUsage: true,
    schemaCreate: true,
    appRoleExists: true,
    appRoleMemberOfProd: false,
    isSuper: false,
    hasUsageOnAppRole: false,
    canCreateRole: false,
    appHasDbConnect: false,
    appHasSchemaUsage: true,
    migrateIsDbOwner: false,
    migrateCanGrantDbConnect: false,
    migrateIsSchemaOwner: true,
    migrateCanGrantSchemaUsage: true,
    migrationFilesReady: true,
  })
  assert.equal(result.ok, false)
  assert.equal(result.appRoleGrants.connectStatus, 'missing_migrate_cannot_grant')
  assert.ok(result.missing.some((m) => /lacks CONNECT/.test(m)))
  assert.ok(result.actions.some((a) => /GRANT CONNECT ON DATABASE gnh_web_staging/.test(a)))
  assert.equal(result.missing.some((m) => /CREATEROLE/i.test(m)), false)
})

test('evaluateStagingCheckPrivileges: missing app CONNECT is OK when migrate is DB owner', () => {
  const result = evaluateStagingCheckPrivileges({
    dbConnect: true,
    dbCreate: true,
    schemaUsage: true,
    schemaCreate: true,
    appRoleExists: true,
    appRoleMemberOfProd: false,
    isSuper: false,
    hasUsageOnAppRole: false,
    canCreateRole: false,
    appHasDbConnect: false,
    appHasSchemaUsage: false,
    migrateIsDbOwner: true,
    migrateCanGrantDbConnect: false,
    migrateIsSchemaOwner: true,
    migrateCanGrantSchemaUsage: false,
    migrationFilesReady: true,
  })
  assert.equal(result.ok, true)
  assert.equal(result.appRoleGrants.connectStatus, 'missing_migrate_can_grant')
  assert.equal(result.appRoleGrants.usageStatus, 'missing_migrate_can_grant')
})

test('evaluateStagingCheckPrivileges: incomplete migration pack fails', () => {
  const result = evaluateStagingCheckPrivileges({
    dbConnect: true,
    dbCreate: true,
    schemaUsage: true,
    schemaCreate: true,
    appRoleExists: true,
    appRoleMemberOfProd: false,
    isSuper: false,
    hasUsageOnAppRole: false,
    canCreateRole: false,
    appHasDbConnect: true,
    appHasSchemaUsage: true,
    migrateIsDbOwner: true,
    migrateCanGrantDbConnect: true,
    migrateIsSchemaOwner: true,
    migrateCanGrantSchemaUsage: true,
    migrationFilesReady: false,
    missingMigrationFiles: ['db/staging/01_grants_gnh_web_stage.sql'],
  })
  assert.equal(result.ok, false)
  assert.ok(result.missing.some((m) => /Migration pack incomplete/.test(m)))
})
