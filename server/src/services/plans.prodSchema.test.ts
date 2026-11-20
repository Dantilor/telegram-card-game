import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import {
  ACTIVE_PLAN_BY_ID_SQL,
  ACTIVE_PLAN_BY_ID_SQL_NO_AUDIENCE,
  getActivePlanById,
  planAllowedForChannel,
} from './plans.js'
import {
  PLANS_CATALOG_SQL_NO_AUDIENCE,
  plansCatalogSql,
} from './plansCatalog.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(here, '../..')

/** Production-like plans: plan_id PK, no id, optionally no audience. */
const PROD_PLANS_DDL = `
CREATE TABLE plans (
  plan_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  price_rub INTEGER NOT NULL,
  duration_days INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMP DEFAULT now()
);
INSERT INTO plans (plan_id, title, price_rub, duration_days, is_active) VALUES
  ('premium_1m', 'Premium 1m', 259, 30, true),
  ('premium_3m', 'Premium 3m', 399, 90, true),
  ('premium_lifetime', 'Premium lifetime', 990, 36500, true);
`

describe('plans queries on production-like schema (no id)', () => {
  it('source never references plans.id in SELECT/WHERE COALESCE', () => {
    for (const rel of ['plans.ts', 'plansCatalog.ts']) {
      const src = fs.readFileSync(path.join(here, rel), 'utf8')
      assert.doesNotMatch(src, /COALESCE\(\s*plan_id\s*,\s*id\s*\)/i, rel)
      assert.doesNotMatch(src, /OR\s+id\s*=/i, rel)
    }
  })

  it('catalog + getActivePlan work without id and without audience', async () => {
    const pg = new PGlite()
    try {
      await pg.exec(PROD_PLANS_DDL)

      const catalog = await pg.query(PLANS_CATALOG_SQL_NO_AUDIENCE)
      assert.equal(catalog.rows.length, 3)
      assert.deepEqual(
        catalog.rows.map((r) => [r.plan_id, r.price_rub]),
        [
          ['premium_1m', 259],
          ['premium_3m', 399],
          ['premium_lifetime', 990],
        ]
      )

      const one = await pg.query(ACTIVE_PLAN_BY_ID_SQL_NO_AUDIENCE, ['premium_1m'])
      assert.equal(one.rows[0]?.price_rub, 259)

      const db = {
        query: async (sql, params) => {
          const result = await pg.query(sql, params)
          return { rows: result.rows }
        },
      }
      const plan = await getActivePlanById('premium_3m', db)
      assert.equal(plan?.plan_id, 'premium_3m')
      assert.equal(plan?.price_rub, 399)
      assert.equal(plan?.audience, 'all')
      assert.equal(planAllowedForChannel(plan, 'telegram'), true)
    } finally {
      await pg.close()
    }
  })

  it('022 applies without id, keeps Telegram prices, leaves WEB inactive; 023 activates WEB', async () => {
    const pg = new PGlite()
    try {
      await pg.exec(PROD_PLANS_DDL)
      const sql022 = fs.readFileSync(
        path.join(serverRoot, 'db/migrations/022_web_plans_audience.sql'),
        'utf8'
      )
      await pg.exec(sql022)

      const cols = await pg.query(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema='public' AND table_name='plans'
          ORDER BY column_name`
      )
      const names = cols.rows.map((r) => r.column_name)
      assert.ok(names.includes('audience'))
      assert.equal(names.includes('id'), false)

      const tg = await pg.query(
        `SELECT plan_id, price_rub, is_active, audience FROM plans
          WHERE plan_id IN ('premium_1m','premium_3m','premium_lifetime')
          ORDER BY plan_id`
      )
      assert.deepEqual(
        tg.rows.map((r) => [r.plan_id, r.price_rub, r.is_active, r.audience]),
        [
          ['premium_1m', 259, true, 'telegram'],
          ['premium_3m', 399, true, 'telegram'],
          ['premium_lifetime', 990, true, 'telegram'],
        ]
      )

      const web = await pg.query(
        `SELECT plan_id, price_rub, is_active, audience FROM plans
          WHERE plan_id LIKE 'premium_web_%' ORDER BY plan_id`
      )
      assert.deepEqual(
        web.rows.map((r) => [r.plan_id, r.price_rub, r.is_active, r.audience]),
        [
          ['premium_web_1m', 259, false, 'web'],
          ['premium_web_3m', 499, false, 'web'],
          ['premium_web_lifetime', 1190, false, 'web'],
        ]
      )

      await pg.exec(sql022)

      const catalogTg = plansCatalogSql('telegram')
      const listed = await pg.query(catalogTg.sql, catalogTg.params)
      assert.equal(listed.rows.length, 3)
      assert.ok(listed.rows.every((r) => r.audience === 'telegram'))

      const catalogWebBefore = plansCatalogSql('web')
      const webListedBefore = await pg.query(catalogWebBefore.sql, catalogWebBefore.params)
      assert.equal(webListedBefore.rows.length, 0)

      const withAudience = await pg.query(ACTIVE_PLAN_BY_ID_SQL, ['premium_1m'])
      assert.equal(withAudience.rows[0]?.audience, 'telegram')

      const sql023 = fs.readFileSync(
        path.join(serverRoot, 'db/migrations/023_web_plans_activate.sql'),
        'utf8'
      )
      await pg.exec(sql023)

      const webActive = await pg.query(
        `SELECT plan_id, price_rub, is_active FROM plans
          WHERE audience = 'web' ORDER BY plan_id`
      )
      assert.deepEqual(
        webActive.rows.map((r) => [r.plan_id, r.price_rub, r.is_active]),
        [
          ['premium_web_1m', 259, true],
          ['premium_web_3m', 499, true],
          ['premium_web_lifetime', 1190, true],
        ]
      )

      const catalogWeb = plansCatalogSql('web')
      const webListed = await pg.query(catalogWeb.sql, catalogWeb.params)
      assert.equal(webListed.rows.length, 3)
    } finally {
      await pg.close()
    }
  })

  it('022 also works when legacy id column exists (staging-like)', async () => {
    const pg = new PGlite()
    try {
      await pg.exec(`
        CREATE TABLE plans (
          id TEXT PRIMARY KEY,
          plan_id TEXT,
          title TEXT NOT NULL,
          price_rub INTEGER NOT NULL,
          duration_days INTEGER NOT NULL,
          is_active BOOLEAN DEFAULT true
        );
        INSERT INTO plans (id, plan_id, title, price_rub, duration_days, is_active) VALUES
          ('premium_1m', 'premium_1m', 'Premium 1m', 259, 30, true),
          ('premium_3m', 'premium_3m', 'Premium 3m', 399, 90, true),
          ('premium_lifetime', 'premium_lifetime', 'Premium lifetime', 990, 36500, true);
      `)
      const sql022 = fs.readFileSync(
        path.join(serverRoot, 'db/migrations/022_web_plans_audience.sql'),
        'utf8'
      )
      await pg.exec(sql022)
      const web = await pg.query(
        `SELECT id, plan_id, is_active, audience FROM plans WHERE plan_id LIKE 'premium_web_%' ORDER BY plan_id`
      )
      assert.equal(web.rows.length, 3)
      assert.ok(web.rows.every((r) => r.is_active === false && r.audience === 'web' && r.id === r.plan_id))
      const tg = await pg.query(`SELECT price_rub FROM plans WHERE plan_id = 'premium_3m'`)
      assert.equal(tg.rows[0]?.price_rub, 399)
    } finally {
      await pg.close()
    }
  })
})