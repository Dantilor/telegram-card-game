/**
 * Production-only applicator for migration 024 (web_telegram_devices) + gnh_app grants.
 *
 * Privilege reality on gnh_supabase (observed):
 *   - gen_user: CREATE on public → can create web_telegram_devices + GRANT
 *   - gnh_app: owns web_telegram_link_challenges → alone can ALTER that table
 *   - gen_user is NOT a member of gnh_app → SET ROLE will not work
 *
 * Strategies (chosen by read-only probes; no ALTER OWNER / no privilege expansion):
 *   single_current — connected role can CREATE + ALTER challenges + GRANT
 *   single_gnh_app — gnh_app can CREATE + owns challenges (apply with gnh_app URL)
 *   dual_role      — gen_user applies 024a + grants; gnh_app applies 024b
 *
 * Modes:
 *   --dry-run     print planned steps (no DB required if URL unset)
 *   --preflight   connect + schema/TLS/privilege strategy (READ ONLY)
 *   (default)     apply after explicit confirmations
 *
 * Env:
 *   PRODUCTION_DATABASE_URL     migrate URL (gen_user or gnh_app) → gnh_supabase + TLS
 *   PRODUCTION_GNH_APP_DATABASE_URL  required for dual_role (and for single_gnh_app if primary URL is gen_user)
 *   GNH_ALLOW_PROD_WEB_MIGRATE=1
 *   CONFIRM_PRODUCTION_WEB_MIGRATE=YES
 *   CONFIRM_PRODUCTION_BACKUP=YES
 *   CONFIRM_PRODUCTION_024_DEVICES=YES
 *   CONFIRM_PRODUCTION_024_DUAL_ROLE=YES  (required when strategy=dual_role)
 *
 * Not wired into API startup. Does not apply 012–023 or plan/tariff changes.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import pg from 'pg'

const here = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.join(here, '..')

export const EXPECTED_DB = 'gnh_supabase'
export const FORBIDDEN_DBS = new Set(['gnh_web_staging', 'postgres', 'template0', 'template1'])
export const APP_ROLE = 'gnh_app'

const SKIP_024A_SQL = `
SELECT to_regclass('public.web_telegram_devices') IS NOT NULL AS present
`

const SKIP_024B_SQL = `
SELECT
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'web_telegram_link_challenges'
      AND column_name = 'device_token_hash'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'web_telegram_link_challenges'
      AND column_name = 'last_error_code'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'web_telegram_link_challenges'
      AND column_name = 'adopted_web_account_id'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'web_telegram_link_challenges'
      AND column_name = 'last_error_at'
  ) AS present
`

const SKIP_GRANTS_SQL = `
SELECT
  to_regclass('public.web_telegram_devices') IS NOT NULL
  AND has_table_privilege('gnh_app', 'web_telegram_devices', 'SELECT')
  AND has_table_privilege('gnh_app', 'web_telegram_devices', 'INSERT')
  AND has_table_privilege('gnh_app', 'web_telegram_devices', 'UPDATE')
  AND has_table_privilege('gnh_app', 'web_telegram_devices', 'DELETE')
  AS present
`

const PREREQ_SQL = `
SELECT
  to_regclass('public.web_accounts') IS NOT NULL AS has_web_accounts,
  to_regclass('public.web_telegram_links') IS NOT NULL AS has_web_telegram_links,
  to_regclass('public.web_telegram_link_challenges') IS NOT NULL AS has_challenges
`

/** @typedef {'single_current'|'single_gnh_app'|'dual_role'|'blocked'} MigrateStrategy */
/** @typedef {{ label: string, file: string, kind: 'ddl'|'grants', skipSql: string, role: 'migrate'|'gnh_app'|'devices_owner' }} Step */

/** @type {Step[]} */
export const STEPS = Object.freeze([
  {
    label: '024a',
    file: 'db/migrations/024a_web_telegram_devices_table.sql',
    kind: 'ddl',
    skipSql: SKIP_024A_SQL,
    role: 'migrate',
  },
  {
    label: '024b',
    file: 'db/migrations/024b_web_telegram_link_challenges_device_cols.sql',
    kind: 'ddl',
    skipSql: SKIP_024B_SQL,
    role: 'gnh_app',
  },
  {
    label: 'grants_web_telegram_devices_gnh_app',
    file: 'db/production/grants_web_telegram_devices_gnh_app.sql',
    kind: 'grants',
    skipSql: SKIP_GRANTS_SQL,
    role: 'devices_owner',
  },
])

export function parseArgs(argv = process.argv) {
  const dryRun = argv.includes('--dry-run')
  const preflight = argv.includes('--preflight')
  if (dryRun && preflight) {
    throw new Error('Use only one of --dry-run or --preflight')
  }
  return { dryRun, preflight, apply: !dryRun && !preflight }
}

export function assertApplyConfirmations(env = process.env, strategy = 'single_current') {
  if (env.GNH_ALLOW_PROD_WEB_MIGRATE !== '1') {
    throw new Error('Refusing apply: set GNH_ALLOW_PROD_WEB_MIGRATE=1 after backup + owner approval')
  }
  if (env.CONFIRM_PRODUCTION_WEB_MIGRATE !== 'YES') {
    throw new Error('Refusing apply: set CONFIRM_PRODUCTION_WEB_MIGRATE=YES')
  }
  if (env.CONFIRM_PRODUCTION_BACKUP !== 'YES') {
    throw new Error(
      'Refusing apply: set CONFIRM_PRODUCTION_BACKUP=YES after verified gnh_supabase backup/snapshot'
    )
  }
  if (env.CONFIRM_PRODUCTION_024_DEVICES !== 'YES') {
    throw new Error(
      'Refusing apply: set CONFIRM_PRODUCTION_024_DEVICES=YES (explicit 024-only confirmation)'
    )
  }
  if (strategy === 'dual_role' && env.CONFIRM_PRODUCTION_024_DUAL_ROLE !== 'YES') {
    throw new Error(
      'Refusing dual-role apply: set CONFIRM_PRODUCTION_024_DUAL_ROLE=YES (024a as gen_user, 024b as gnh_app)'
    )
  }
}

function resolve(rel) {
  return path.join(serverRoot, rel)
}

function redact(msg) {
  return String(msg)
    .replace(/postgresql:\/\/[^\s'"]+/gi, 'postgresql://***')
    .replace(/postgres:\/\/[^\s'"]+/gi, 'postgres://***')
    .replace(/password[=:]\s*\S+/gi, 'password=***')
}

export function assertFilesExist(steps = STEPS) {
  for (const step of steps) {
    const full = resolve(step.file)
    if (!fs.existsSync(full)) throw new Error(`Missing ${step.file}`)
  }
  const combined = resolve('db/migrations/024_web_telegram_devices.sql')
  if (!fs.existsSync(combined)) throw new Error('Missing db/migrations/024_web_telegram_devices.sql')
}

export function parseDbUrl(raw) {
  if (!raw) return null
  try {
    const u = new URL(raw)
    const dbName = decodeURIComponent(u.pathname.replace(/^\//, '').split('/')[0] || '')
    return { host: u.hostname, user: decodeURIComponent(u.username || ''), dbName }
  } catch {
    throw new Error('PRODUCTION_DATABASE_URL is not a valid URL')
  }
}

export function assertProductionTarget(info, { allowAppRoleLogin = true } = {}) {
  if (!info) throw new Error('Set PRODUCTION_DATABASE_URL (preferred) or DATABASE_URL')
  if (!info.dbName || FORBIDDEN_DBS.has(info.dbName) || /gnh_web_/i.test(info.dbName)) {
    throw new Error(`Refusing database "${info.dbName}"`)
  }
  if (info.dbName !== EXPECTED_DB) {
    throw new Error(`Refusing: expected database ${EXPECTED_DB}, got "${info.dbName}"`)
  }
  if (!info.host) throw new Error('Host missing from database URL')
  if (!info.user) throw new Error('User missing from database URL')
  if (info.user === 'gnh_web_stage') {
    throw new Error('Refusing: do not use staging app role gnh_web_stage on production')
  }
  if (!allowAppRoleLogin && info.user === APP_ROLE) {
    throw new Error(`Refusing: unexpected ${APP_ROLE} URL in this context`)
  }
  const expectHost = (process.env.PRODUCTION_EXPECT_HOST || '').trim()
  if (expectHost && info.host.toLowerCase() !== expectHost.toLowerCase()) {
    throw new Error('Refusing: host does not match PRODUCTION_EXPECT_HOST')
  }
  const pgSslMode = (process.env.PGSSLMODE || '').trim().toLowerCase()
  if (pgSslMode === 'disable' || ['0', 'false', 'off', 'no', 'allow'].includes(pgSslMode)) {
    throw new Error('Refusing: PGSSLMODE disables TLS')
  }
}

/**
 * @param {{
 *   migrateUser: string,
 *   canCreateInPublic: boolean,
 *   ownsChallenges: boolean,
 *   isSuperuser: boolean,
 *   gnhAppExists: boolean,
 *   gnhAppCanLogin: boolean,
 *   gnhAppCanCreateInPublic: boolean,
 *   canSelectLinks: boolean,
 *   canReferenceAccounts: boolean,
 *   challengesOwner: string | null,
 * }} row
 */
export function chooseMigrateStrategy(row) {
  const notes = []
  if (!row.gnhAppExists) {
    return {
      strategy: /** @type {MigrateStrategy} */ ('blocked'),
      blockers: ['role gnh_app does not exist'],
      notes,
      canCreateDevicesTable: false,
      canAlterChallenges: false,
      canGrantDevicesToGnhApp: false,
      gnhAppCanCreateInPublic: false,
      gnhAppCanLogin: false,
      challengesOwner: row.challengesOwner,
      migrateUser: row.migrateUser,
    }
  }

  const canCreate = Boolean(row.canCreateInPublic || row.isSuperuser)
  const canAlter = Boolean(row.ownsChallenges || row.isSuperuser)
  const canSeed =
    Boolean(row.isSuperuser) ||
    (Boolean(row.canSelectLinks) && Boolean(row.canReferenceAccounts))
  const gnhCreate = Boolean(row.gnhAppCanCreateInPublic)

  if (canCreate && canAlter && (canSeed || row.ownsChallenges)) {
    notes.push('Connected role can perform 024a + 024b + grants alone')
    return {
      strategy: /** @type {MigrateStrategy} */ ('single_current'),
      blockers: [],
      notes,
      canCreateDevicesTable: canCreate,
      canAlterChallenges: canAlter,
      canGrantDevicesToGnhApp: canCreate,
      gnhAppCanCreateInPublic: gnhCreate,
      gnhAppCanLogin: Boolean(row.gnhAppCanLogin),
      challengesOwner: row.challengesOwner,
      migrateUser: row.migrateUser,
    }
  }

  if (gnhCreate && row.challengesOwner === APP_ROLE) {
    notes.push(
      'gnh_app has CREATE on public and owns challenges — prefer single-role apply as gnh_app (no ALTER OWNER)'
    )
    return {
      strategy: /** @type {MigrateStrategy} */ ('single_gnh_app'),
      blockers: [],
      notes,
      canCreateDevicesTable: canCreate,
      canAlterChallenges: canAlter,
      canGrantDevicesToGnhApp: canCreate || gnhCreate,
      gnhAppCanCreateInPublic: gnhCreate,
      gnhAppCanLogin: Boolean(row.gnhAppCanLogin),
      challengesOwner: row.challengesOwner,
      migrateUser: row.migrateUser,
    }
  }

  const dualBlockers = []
  if (!canCreate) dualBlockers.push('migrate user lacks CREATE on schema public for 024a')
  if (!canSeed && canCreate) {
    dualBlockers.push(
      'migrate user cannot seed web_telegram_devices (need SELECT on web_telegram_links + REFERENCES on web_accounts)'
    )
  }
  if (row.challengesOwner !== APP_ROLE) {
    dualBlockers.push(
      `dual-role expects challenges owner gnh_app (got ${row.challengesOwner || 'unknown'})`
    )
  }
  if (!row.gnhAppCanLogin) {
    notes.push(
      'gnh_app rolcanlogin=false — dual-role still possible only if a LOGIN member can SET ROLE (not available here)'
    )
    dualBlockers.push('gnh_app cannot LOGIN; cannot open PRODUCTION_GNH_APP_DATABASE_URL session')
  }

  if (dualBlockers.length === 0) {
    notes.push(
      'Use dual-role: PRODUCTION_DATABASE_URL=gen_user for 024a+grants; PRODUCTION_GNH_APP_DATABASE_URL=gnh_app for 024b'
    )
    return {
      strategy: /** @type {MigrateStrategy} */ ('dual_role'),
      blockers: [],
      notes,
      canCreateDevicesTable: true,
      canAlterChallenges: false,
      canGrantDevicesToGnhApp: true,
      gnhAppCanCreateInPublic: gnhCreate,
      gnhAppCanLogin: Boolean(row.gnhAppCanLogin),
      challengesOwner: row.challengesOwner,
      migrateUser: row.migrateUser,
    }
  }

  const blockers = []
  if (!canCreate) blockers.push('migrate user lacks CREATE on schema public')
  if (!canAlter) {
    blockers.push(
      `migrate user cannot ALTER web_telegram_link_challenges (owner=${row.challengesOwner || 'unknown'}, user=${row.migrateUser})`
    )
  }
  blockers.push(...dualBlockers.filter((b) => !blockers.includes(b)))
  if (!gnhCreate) {
    blockers.push('gnh_app lacks CREATE on schema public (cannot take single_gnh_app path)')
  }

  return {
    strategy: /** @type {MigrateStrategy} */ ('blocked'),
    blockers,
    notes,
    canCreateDevicesTable: canCreate,
    canAlterChallenges: canAlter,
    canGrantDevicesToGnhApp: canCreate,
    gnhAppCanCreateInPublic: gnhCreate,
    gnhAppCanLogin: Boolean(row.gnhAppCanLogin),
    challengesOwner: row.challengesOwner,
    migrateUser: row.migrateUser,
  }
}

/** @deprecated use chooseMigrateStrategy */
export function evaluateMigratePrivileges(row) {
  const chosen = chooseMigrateStrategy({
    migrateUser: row.migrateUser,
    canCreateInPublic: row.canCreateInPublic,
    ownsChallenges: row.ownsChallenges,
    isSuperuser: row.isSuperuser,
    gnhAppExists: row.gnhAppExists,
    gnhAppCanLogin: row.gnhAppCanLogin,
    gnhAppCanCreateInPublic: row.gnhAppCanCreateInPublic ?? false,
    canSelectLinks: row.canSelectLinks ?? true,
    canReferenceAccounts: row.canReferenceAccounts ?? true,
    challengesOwner: row.challengesOwner,
  })
  return {
    ok: chosen.strategy !== 'blocked',
    blockers: chosen.blockers,
    strategy: chosen.strategy,
    notes: chosen.notes,
    canCreateDevicesTable: chosen.canCreateDevicesTable,
    canAlterChallenges: chosen.canAlterChallenges,
    canGrantDevicesToGnhApp: chosen.canGrantDevicesToGnhApp,
    gnhAppCanLogin: chosen.gnhAppCanLogin,
    gnhAppCanCreateInPublic: chosen.gnhAppCanCreateInPublic,
    challengesOwner: chosen.challengesOwner,
    migrateUser: chosen.migrateUser,
  }
}

export async function inspectAppRole(client) {
  const { rows } = await client.query(
    `SELECT r.rolname,
            r.rolcanlogin,
            pg_has_role(current_user, r.oid, 'member') AS migrate_user_is_member
       FROM pg_roles r
      WHERE r.rolname = $1`,
    [APP_ROLE]
  )
  if (!rows[0]) {
    throw new Error(`Role ${APP_ROLE} does not exist (production API privilege role)`)
  }
  return {
    role: rows[0].rolname,
    canLogin: Boolean(rows[0].rolcanlogin),
    migrateUserIsMember: Boolean(rows[0].migrate_user_is_member),
  }
}

export async function inspectMigratePrivileges(client) {
  const { rows } = await client.query(
    `SELECT
       current_user AS migrate_user,
       has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_in_public,
       has_schema_privilege('gnh_app', 'public', 'CREATE') AS gnh_app_can_create_in_public,
       has_table_privilege(current_user, 'web_telegram_links', 'SELECT') AS can_select_links,
       has_table_privilege(current_user, 'web_accounts', 'REFERENCES') AS can_reference_accounts,
       EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1) AS gnh_app_exists,
       (SELECT r.rolcanlogin FROM pg_roles r WHERE r.rolname = $1) AS gnh_app_can_login,
       (SELECT r.rolsuper FROM pg_roles r WHERE r.rolname = current_user) AS is_superuser,
       (
         SELECT pg_get_userbyid(c.relowner)
           FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public'
            AND c.relkind = 'r'
            AND c.relname = 'web_telegram_link_challenges'
       ) AS challenges_owner,
       (
         SELECT pg_get_userbyid(c.relowner) = current_user
           FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public'
            AND c.relkind = 'r'
            AND c.relname = 'web_telegram_link_challenges'
       ) AS owns_challenges`,
    [APP_ROLE]
  )
  const raw = rows[0] || {}
  return evaluateMigratePrivileges({
    migrateUser: String(raw.migrate_user || ''),
    canCreateInPublic: Boolean(raw.can_create_in_public),
    ownsChallenges: Boolean(raw.owns_challenges),
    isSuperuser: Boolean(raw.is_superuser),
    gnhAppExists: Boolean(raw.gnh_app_exists),
    challengesOwner: raw.challenges_owner != null ? String(raw.challenges_owner) : null,
    gnhAppCanLogin: Boolean(raw.gnh_app_can_login),
    gnhAppCanCreateInPublic: Boolean(raw.gnh_app_can_create_in_public),
    canSelectLinks: Boolean(raw.can_select_links),
    canReferenceAccounts: Boolean(raw.can_reference_accounts),
  })
}

async function loadResolvePgPoolConfig() {
  const distPath = path.join(serverRoot, 'dist', 'dbTls.js')
  if (!fs.existsSync(distPath)) {
    throw new Error('Missing dist/dbTls.js — run `npm run build:api` in server/ first')
  }
  const mod = await import(pathToFileURL(distPath).href)
  return mod.resolvePgPoolConfig
}

async function withClient(databaseUrl, fn, { readOnly = true } = {}) {
  const prev = process.env.DATABASE_URL
  process.env.DATABASE_URL = databaseUrl
  try {
    const resolvePgPoolConfig = await loadResolvePgPoolConfig()
    const resolved = resolvePgPoolConfig(process.env)
    if (!resolved.ssl || resolved.ssl.rejectUnauthorized !== true) {
      throw new Error('Refusing: TLS must verify server certificates (rejectUnauthorized)')
    }
    /** @type {import('pg').ClientConfig} */
    const cfg = {
      connectionString: resolved.connectionString,
      ssl: resolved.ssl,
      connectionTimeoutMillis: 30000,
    }
    if (readOnly) {
      cfg.options = '-c default_transaction_read_only=on'
    }
    const client = new pg.Client(cfg)
    await client.connect()
    try {
      return await fn(client, resolved)
    } finally {
      await client.end()
    }
  } finally {
    if (prev === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = prev
  }
}

async function openWriteClient(databaseUrl) {
  const prev = process.env.DATABASE_URL
  process.env.DATABASE_URL = databaseUrl
  try {
    const resolvePgPoolConfig = await loadResolvePgPoolConfig()
    const resolved = resolvePgPoolConfig(process.env)
    if (!resolved.ssl || resolved.ssl.rejectUnauthorized !== true) {
      throw new Error('Refusing: TLS must verify server certificates')
    }
    const client = new pg.Client({
      connectionString: resolved.connectionString,
      ssl: resolved.ssl,
      connectionTimeoutMillis: 60000,
    })
    await client.connect()
    return {
      client,
      resolved,
      restoreEnv() {
        if (prev === undefined) delete process.env.DATABASE_URL
        else process.env.DATABASE_URL = prev
      },
    }
  } catch (err) {
    if (prev === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = prev
    throw err
  }
}

async function probeSkip(client, step) {
  const result = await client.query(step.skipSql)
  return Boolean(result.rows[0]?.present)
}

async function assertPrerequisites(client) {
  const { rows } = await client.query(PREREQ_SQL)
  const row = rows[0] || {}
  const missing = []
  if (!row.has_web_accounts) missing.push('web_accounts')
  if (!row.has_web_telegram_links) missing.push('web_telegram_links')
  if (!row.has_challenges) missing.push('web_telegram_link_challenges')
  if (missing.length) {
    throw new Error(
      `024 prerequisites missing (${missing.join(', ')}). Apply through-022 first; this script never applies 012–023.`
    )
  }
}

async function listPlan(client, steps = STEPS) {
  const plan = []
  for (const step of steps) {
    const skip = await probeSkip(client, step)
    plan.push({ ...step, skip })
  }
  return plan
}

function printDryRunFilesOnly() {
  console.log('phase=024-devices')
  for (const step of STEPS) {
    console.log(`DRY ${step.label} role=${step.role} ${step.file}`)
  }
  console.log(`app_role=${APP_ROLE} (grants target; production API privilege role)`)
  console.log('NOTE: 012–023 and plan/tariff changes are excluded.')
  console.log('Strategies: single_current | single_gnh_app | dual_role')
  console.log('Confirmations for apply: GNH_ALLOW_PROD_WEB_MIGRATE=1')
  console.log('  CONFIRM_PRODUCTION_WEB_MIGRATE=YES')
  console.log('  CONFIRM_PRODUCTION_BACKUP=YES')
  console.log('  CONFIRM_PRODUCTION_024_DEVICES=YES')
  console.log('  CONFIRM_PRODUCTION_024_DUAL_ROLE=YES (dual_role only)')
  console.log('Dry-run OK (files only). No database contacted.')
}

function resolveUrls(env = process.env) {
  const primary = String(env.PRODUCTION_DATABASE_URL || env.DATABASE_URL || '').trim()
  const gnhApp = String(env.PRODUCTION_GNH_APP_DATABASE_URL || '').trim()
  return { primary, gnhApp }
}

/**
 * Map step.role → which URL to use for a strategy.
 * @param {MigrateStrategy} strategy
 * @param {{ primary: string, gnhApp: string }} urls
 * @param {string} primaryUser
 */
export function resolveStepUrl(strategy, step, urls, primaryUser) {
  if (strategy === 'single_current') return urls.primary
  if (strategy === 'single_gnh_app') {
    if (primaryUser === APP_ROLE) return urls.primary
    if (!urls.gnhApp) {
      throw new Error(
        'single_gnh_app requires PRODUCTION_GNH_APP_DATABASE_URL (or set PRODUCTION_DATABASE_URL as gnh_app)'
      )
    }
    return urls.gnhApp
  }
  // dual_role
  if (step.role === 'gnh_app') {
    if (!urls.gnhApp) {
      throw new Error('dual_role requires PRODUCTION_GNH_APP_DATABASE_URL for step 024b')
    }
    return urls.gnhApp
  }
  return urls.primary
}

async function runPreflight(databaseUrl, env = process.env) {
  const urls = resolveUrls(env)
  await withClient(databaseUrl, async (client, resolved) => {
    const meta = await client.query(
      `SELECT current_database() AS db, current_user AS usr,
              (SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()) AS ssl`
    )
    const row = meta.rows[0]
    if (row.db !== EXPECTED_DB) throw new Error(`Wrong database: ${row.db}`)
    if (!row.ssl) throw new Error('TLS not active')
    await assertPrerequisites(client)
    const appRole = await inspectAppRole(client)
    const priv = await inspectMigratePrivileges(client)
    const plan = await listPlan(client)
    console.log(
      `phase=024-devices database=${row.db} migrate_user=${row.usr} tls=on ca=${resolved.summary.caSource}`
    )
    console.log(
      `app_role=${appRole.role} can_login=${appRole.canLogin} migrate_user_member_of_app_role=${appRole.migrateUserIsMember}`
    )
    if (appRole.canLogin) {
      console.log(
        'NOTE: gnh_app has LOGIN (rolcanlogin=true). That does not prove password or CREATE privilege. Do not ALTER ROLE.'
      )
    }
    console.log(
      `priv create_devices=${priv.canCreateDevicesTable} alter_challenges=${priv.canAlterChallenges} ` +
        `grant_devices_to_gnh_app=${priv.canGrantDevicesToGnhApp} gnh_app_create_public=${priv.gnhAppCanCreateInPublic} ` +
        `challenges_owner=${priv.challengesOwner || 'unknown'}`
    )
    console.log(`strategy=${priv.strategy}`)
    for (const note of priv.notes || []) console.log(`NOTE: ${note}`)
    for (const step of plan) {
      console.log(`${step.skip ? 'SKIP' : 'NEED'} ${step.label} role=${step.role} ${step.file}`)
    }

    if (priv.strategy === 'blocked') {
      throw new Error(`PRIVILEGE_BLOCKER: ${priv.blockers.join('; ')}`)
    }

    if (priv.strategy === 'dual_role') {
      if (!urls.gnhApp) {
        console.log(
          'NEXT: set PRODUCTION_GNH_APP_DATABASE_URL=postgresql://gnh_app:…/gnh_supabase?sslmode=verify-full'
        )
        console.log(
          'NEXT: re-run --preflight with both URLs (still read-only). Do not change passwords/roles/owners.'
        )
      } else {
        const gnhInfo = parseDbUrl(urls.gnhApp)
        assertProductionTarget(gnhInfo)
        if (gnhInfo.user !== APP_ROLE) {
          throw new Error(`PRODUCTION_GNH_APP_DATABASE_URL user must be ${APP_ROLE}, got ${gnhInfo.user}`)
        }
        await withClient(urls.gnhApp, async (gnhClient, gnhResolved) => {
          const gnhMeta = await gnhClient.query(
            `SELECT current_user AS usr, current_database() AS db,
                    (SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()) AS ssl,
                    has_schema_privilege(current_user, 'public', 'CREATE') AS can_create,
                    (
                      SELECT pg_get_userbyid(c.relowner) = current_user
                        FROM pg_class c
                        JOIN pg_namespace n ON n.oid = c.relnamespace
                       WHERE n.nspname='public' AND c.relname='web_telegram_link_challenges'
                    ) AS owns_challenges`
          )
          const g = gnhMeta.rows[0]
          if (g.db !== EXPECTED_DB) throw new Error(`gnh_app URL wrong database: ${g.db}`)
          if (!g.ssl) throw new Error('gnh_app URL TLS not active')
          if (g.usr !== APP_ROLE) throw new Error(`gnh_app URL connected as ${g.usr}`)
          if (!g.owns_challenges) throw new Error('gnh_app URL does not own web_telegram_link_challenges')
          console.log(
            `gnh_app_url_ok user=${g.usr} tls=on ca=${gnhResolved.summary.caSource} owns_challenges=${g.owns_challenges} create_public=${g.can_create}`
          )
        })
      }
    }

    if (priv.strategy === 'single_gnh_app' && row.usr !== APP_ROLE && !urls.gnhApp) {
      console.log(
        'NEXT: set PRODUCTION_DATABASE_URL as gnh_app OR PRODUCTION_GNH_APP_DATABASE_URL, then re-run --preflight'
      )
    }

    console.log('PREFLIGHT_OK')
    console.log(`PRIVILEGES_OK strategy=${priv.strategy} (read-only checks only; no DDL applied)`)
  })
}

async function applyStepOnUrl(databaseUrl, step) {
  const { client, restoreEnv } = await openWriteClient(databaseUrl)
  try {
    const meta = await client.query(`SELECT current_database() AS db, current_user AS usr`)
    if (meta.rows[0].db !== EXPECTED_DB) throw new Error(`Wrong database: ${meta.rows[0].db}`)
    const already = await probeSkip(client, step)
    if (already) {
      console.log(`SKIP ${step.label} (already present) as ${meta.rows[0].usr}`)
      return 'skipped'
    }
    const sql = fs.readFileSync(resolve(step.file), 'utf8')
    await client.query('BEGIN')
    try {
      await client.query(sql)
      await client.query('COMMIT')
    } catch (e) {
      try {
        await client.query('ROLLBACK')
      } catch {
        /* ignore */
      }
      throw e
    }
    console.log(`OK ${step.label} as ${meta.rows[0].usr}`)
    return 'applied'
  } finally {
    await client.end().catch(() => {})
    restoreEnv()
  }
}

async function runApply(env = process.env) {
  const urls = resolveUrls(env)
  if (!urls.primary) throw new Error('Set PRODUCTION_DATABASE_URL (preferred) or DATABASE_URL')
  const primaryInfo = parseDbUrl(urls.primary)
  assertProductionTarget(primaryInfo)

  // Discover strategy read-only first
  const priv = await withClient(urls.primary, async (client) => {
    await assertPrerequisites(client)
    return inspectMigratePrivileges(client)
  })

  if (priv.strategy === 'blocked') {
    throw new Error(`Refusing apply: ${priv.blockers.join('; ')}`)
  }

  assertApplyConfirmations(env, priv.strategy)

  if (priv.strategy === 'dual_role' || (priv.strategy === 'single_gnh_app' && primaryInfo.user !== APP_ROLE)) {
    if (!urls.gnhApp && priv.strategy === 'dual_role') {
      throw new Error('dual_role apply requires PRODUCTION_GNH_APP_DATABASE_URL')
    }
    if (!urls.gnhApp && priv.strategy === 'single_gnh_app') {
      throw new Error(
        'single_gnh_app apply requires PRODUCTION_GNH_APP_DATABASE_URL or PRODUCTION_DATABASE_URL as gnh_app'
      )
    }
    if (urls.gnhApp) {
      const gnhInfo = parseDbUrl(urls.gnhApp)
      assertProductionTarget(gnhInfo)
      if (gnhInfo.user !== APP_ROLE) {
        throw new Error(`PRODUCTION_GNH_APP_DATABASE_URL user must be ${APP_ROLE}`)
      }
    }
  }

  console.log(`apply strategy=${priv.strategy}`)

  for (const step of STEPS) {
    const url = resolveStepUrl(priv.strategy, step, urls, primaryInfo.user)
    const info = parseDbUrl(url)
    // Soft role expectations
    if (priv.strategy === 'dual_role' && step.role === 'gnh_app' && info.user !== APP_ROLE) {
      throw new Error(`Step ${step.label} must run as ${APP_ROLE}`)
    }
    await applyStepOnUrl(url, step)
  }

  // Verify final state via primary URL
  await withClient(urls.primary, async (client) => {
    const plan = await listPlan(client)
    const still = plan.filter((s) => !s.skip)
    if (still.length) {
      throw new Error(
        `Post-apply verification incomplete (partial apply possible): still need ${still
          .map((s) => s.label)
          .join(', ')}. Re-run apply after fixing; steps are idempotent.`
      )
    }
  })

  console.log('024 complete via strategy=' + priv.strategy + ' (012–023 untouched).')
}

async function main() {
  assertFilesExist(STEPS)
  const mode = parseArgs(process.argv)
  const { primary } = resolveUrls(process.env)

  if (mode.dryRun && !primary) {
    printDryRunFilesOnly()
    return
  }

  const info = parseDbUrl(primary)
  assertProductionTarget(info)

  if (mode.dryRun) {
    await withClient(primary, async (client) => {
      await assertPrerequisites(client)
      const priv = await inspectMigratePrivileges(client)
      const plan = await listPlan(client)
      console.log('phase=024-devices')
      console.log(`strategy=${priv.strategy}`)
      for (const step of plan) {
        console.log(
          `${step.skip ? 'DRY_SKIP' : 'DRY_APPLY'} ${step.label} role=${step.role} ${step.file}`
        )
      }
      console.log('NOTE: 012–023 excluded from this dry-run.')
      console.log('Dry-run OK (read-only plan).')
    })
    return
  }

  if (mode.preflight) {
    await runPreflight(primary, process.env)
    return
  }

  await runApply(process.env)
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectRun) {
  main().catch((e) => {
    console.error(redact(e instanceof Error ? e.message : e))
    process.exit(1)
  })
}