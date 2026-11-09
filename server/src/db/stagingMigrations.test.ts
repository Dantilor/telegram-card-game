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

const STAGING_ORDER = [
  'db/schema.sql',
  'db/migrations/001_payments_new_schema.sql',
  'db/migrations/002_plans_yookassa.sql',
  'db/staging/003_plans_three_tiers_fixed.sql',
  'db/migrations/004_payments_premium_granted_at.sql',
  'db/migrations/005_legal_documents.sql',
  'db/migrations/006_sled_rooms.sql',
  'db/migrations/007_sled_rls.sql',
  'db/migrations/008_mafia_shadows.sql',
  'db/migrations/009_doubles.sql',
  'db/migrations/010_infected.sql',
  'db/staging/00_roles_optional.sql',
  'db/migrations/011_party_app_grants.sql',
  'db/migrations/012_web_sessions.sql',
  'db/migrations/013_web_session_profile.sql',
  'db/migrations/014_legal_confirmation_source_web.sql',
]

test('staging migration files exist in apply order', () => {
  for (const rel of STAGING_ORDER) {
    assert.ok(fs.existsSync(path.join(serverRoot, rel)), rel)
  }
  assert.ok(fs.existsSync(path.join(serverRoot, 'db/staging/seed_minimal.sql')))
  assert.ok(fs.existsSync(path.join(serverRoot, 'scripts/apply-staging-migrations.mjs')))
})

test('clean DB accepts staging migration chain twice (idempotent core)', async () => {
  const pg = new PGlite()
  try {
    for (const rel of STAGING_ORDER) {
      await pg.exec(readSql(rel))
    }
    // Second pass of additive WEB + legal migrations must not destroy data.
    await pg.exec(readSql('db/migrations/012_web_sessions.sql'))
    await pg.exec(readSql('db/migrations/013_web_session_profile.sql'))
    await pg.exec(readSql('db/migrations/014_legal_confirmation_source_web.sql'))
    await pg.exec(readSql('db/staging/003_plans_three_tiers_fixed.sql'))
    await pg.exec(readSql('db/staging/seed_minimal.sql'))
    await pg.exec(readSql('db/staging/seed_minimal.sql'))

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
  } finally {
    await pg.close()
  }
})
