import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const here = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(here, '../..')

function readSql(rel: string): string {
  return fs.readFileSync(path.join(serverRoot, rel), 'utf8')
}

/** Schema/RLS chain used by apply-staging-migrations.mjs (grants need LOGIN role). */
const STAGING_ORDER = [
  'db/schema.sql',
  'db/migrations/001_payments_new_schema.sql',
  'db/migrations/002_plans_yookassa.sql',
  'db/staging/003_plans_three_tiers_fixed.sql',
  'db/migrations/004_payments_premium_granted_at.sql',
  'db/migrations/005_legal_documents.sql',
  'db/migrations/006_sled_rooms.sql',
  'db/staging/007_sled_rls_staging.sql',
  'db/migrations/008_mafia_shadows.sql',
  'db/migrations/009_doubles.sql',
  'db/migrations/010_infected.sql',
  'db/staging/00_roles_optional.sql',
  'db/staging/011_party_rls_staging.sql',
  'db/migrations/012_web_sessions.sql',
  'db/migrations/013_web_session_profile.sql',
  'db/migrations/014_legal_confirmation_source_web.sql',
]

const STAGING_SQL_ISOLATION = [
  'db/staging/00_roles_optional.sql',
  'db/staging/007_sled_rls_staging.sql',
  'db/staging/011_party_rls_staging.sql',
  'db/staging/01_grants_gnh_web_stage.sql',
]

test('staging migration files exist in apply order', () => {
  for (const rel of STAGING_ORDER) {
    assert.ok(fs.existsSync(path.join(serverRoot, rel)), rel)
  }
  assert.ok(fs.existsSync(path.join(serverRoot, 'db/staging/seed_minimal.sql')))
  assert.ok(fs.existsSync(path.join(serverRoot, 'db/staging/01_grants_gnh_web_stage.sql')))
  assert.ok(fs.existsSync(path.join(serverRoot, 'scripts/apply-staging-migrations.mjs')))
})

test('staging SQL never creates/alters/grants production role gnh_app', () => {
  for (const rel of STAGING_SQL_ISOLATION) {
    const sql = readSql(rel)
    assert.doesNotMatch(sql, /CREATE\s+ROLE\s+gnh_app/i, rel)
    assert.doesNotMatch(sql, /ALTER\s+ROLE\s+gnh_app/i, rel)
    assert.doesNotMatch(sql, /GRANT\s+gnh_app\s+TO/i, rel)
    assert.doesNotMatch(sql, /GRANT\b[^;]*\bTO\s+gnh_app\b/i, rel)
    assert.doesNotMatch(sql, /CREATE\s+POLICY\b[^;]*\bTO\s+gnh_app\b/i, rel)
  }
})

test('grants SQL is staging-gated and never targets gnh_supabase REVOKE', () => {
  const sql = readSql('db/staging/01_grants_gnh_web_stage.sql')
  assert.match(sql, /gnh_web_staging/)
  assert.match(sql, /gnh_web_stage/)
  assert.match(sql, /party_gnh_web_stage_backend/)
  assert.match(sql, /refusing grants on production database gnh_supabase/)
  assert.doesNotMatch(sql, /^\s*REVOKE\b[^;]*gnh_supabase/im)
  assert.doesNotMatch(sql, /GRANT\s+gnh_app\s+TO/i)
})

test('clean DB accepts staging migration chain twice (idempotent core)', async () => {
  const pg = new PGlite()
  try {
    for (const rel of STAGING_ORDER) {
      // PGlite has no current_database() name gnh_web_staging — patch guards for unit run.
      let sql = readSql(rel)
      if (rel.startsWith('db/staging/')) {
        sql = sql
          .replace(
            /IF current_database\(\) = 'gnh_supabase' THEN[\s\S]*?END IF;/g,
            'IF false THEN NULL; END IF;'
          )
          .replace(
            /IF current_database\(\) IS DISTINCT FROM 'gnh_web_staging' THEN[\s\S]*?END IF;/g,
            'IF false THEN NULL; END IF;'
          )
      }
      await pg.exec(sql)
    }
    await pg.exec(readSql('db/migrations/012_web_sessions.sql'))
    await pg.exec(readSql('db/migrations/013_web_session_profile.sql'))
    await pg.exec(readSql('db/migrations/014_legal_confirmation_source_web.sql'))
    await pg.exec(readSql('db/staging/003_plans_three_tiers_fixed.sql'))
    await pg.exec(readSql('db/staging/seed_minimal.sql'))
    await pg.exec(readSql('db/staging/seed_minimal.sql'))

    const required = [
      'users',
      'subscriptions',
      'payments',
      'web_sessions',
      'web_oidc_states',
      'legal_evidence',
      'sled_rooms',
      'mafia_rooms',
      'doubles_rooms',
      'infected_rooms',
    ]
    const tables = await pg.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename = ANY($1::text[])
        ORDER BY 1`,
      [required]
    )
    assert.equal(tables.rows.length, required.length)

    const users = await pg.query<{ c: string }>(`SELECT count(*)::text AS c FROM users WHERE telegram_id BETWEEN 900001 AND 900004`)
    assert.equal(users.rows[0]?.c, '4')

    const plans = await pg.query<{ c: string }>(`SELECT count(*)::text AS c FROM plans WHERE plan_id IN ('premium_1m','premium_3m','premium_lifetime')`)
    assert.equal(plans.rows[0]?.c, '3')

    const sessionsCols = await pg.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'web_sessions' AND column_name IN ('display_name','username','picture_url')`
    )
    assert.equal(sessionsCols.rows.length, 3)

    const constraint = await pg.query<{ consrc: string | null }>(
      `SELECT pg_get_constraintdef(oid) AS consrc
         FROM pg_constraint
        WHERE conname = 'legal_evidence_source_check'`
    )
    assert.match(String(constraint.rows[0]?.consrc ?? ''), /telegram_login_web/)

    const rls = await pg.query<{ relname: string; relrowsecurity: boolean }>(
      `SELECT c.relname, c.relrowsecurity
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname IN ('sled_rooms','mafia_rooms','doubles_rooms','infected_rooms')
        ORDER BY 1`
    )
    assert.equal(rls.rows.length, 4)
    assert.ok(rls.rows.every((r) => r.relrowsecurity === true))
  } finally {
    await pg.close()
  }
})
