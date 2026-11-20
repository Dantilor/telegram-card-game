import { query } from '../db.js'
import { createPublicTtlCache, weakEtagFromJson } from './publicCache.js'
import { sqlTimingLog } from '../middleware/requestTiming.js'
import { isMissingAudienceColumn } from './plans.js'

export type PublicPlan = {
  id: string
  title: string
  priceRub: number
  durationDays: number
  audience: 'all' | 'telegram' | 'web'
}

export type PlansCatalogPayload = {
  ok: true
  plans: PublicPlan[]
}

export type PlansAudienceFilter = 'telegram' | 'web' | 'all'

/** In-process only: cuts repeat SQL under VPN reconnect storms. Checkout never reads this. */
const TTL_MS = 15_000
const caches = {
  telegram: createPublicTtlCache<PlansCatalogPayload>(TTL_MS),
  web: createPublicTtlCache<PlansCatalogPayload>(TTL_MS),
  all: createPublicTtlCache<PlansCatalogPayload>(TTL_MS),
}

export function clearPlansCatalogCache(): void {
  caches.telegram.clear()
  caches.web.clear()
  caches.all.clear()
}

export function audienceSql(filter: PlansAudienceFilter): { sql: string; params: string[] } {
  if (filter === 'all') {
    return { sql: `COALESCE(audience, 'all') IN ('all', 'telegram', 'web')`, params: [] }
  }
  if (filter === 'web') {
    return { sql: `COALESCE(audience, 'all') IN ('all', 'web')`, params: [] }
  }
  // telegram (default for Mini App / unspecified)
  return { sql: `COALESCE(audience, 'all') IN ('all', 'telegram')`, params: [] }
}

/** Production `plans` has `plan_id` — never SELECT/WHERE `plans.id`. */
export function plansCatalogSql(filter: PlansAudienceFilter): { sql: string; params: string[] } {
  const where = audienceSql(filter)
  return {
    sql: `SELECT plan_id, title, price_rub, duration_days,
              COALESCE(audience, 'all') AS audience
       FROM plans
       WHERE is_active = true AND (${where.sql})
       ORDER BY duration_days ASC, price_rub ASC`,
    params: where.params,
  }
}

export const PLANS_CATALOG_SQL_NO_AUDIENCE = `SELECT plan_id, title, price_rub, duration_days
         FROM plans WHERE is_active = true
         ORDER BY duration_days ASC, price_rub ASC`

export async function getPlansCatalog(
  filter: PlansAudienceFilter = 'telegram'
): Promise<{
  payload: PlansCatalogPayload
  etag: string
  cacheHit: boolean
  sqlMs: number | null
}> {
  const cache = caches[filter]
  const hit = cache.get()
  if (hit) {
    return { payload: hit.value, etag: hit.etag, cacheHit: true, sqlMs: null }
  }

  const started = process.hrtime.bigint()
  let rows: Array<{
    plan_id: string
    title: string
    price_rub: number
    duration_days: number
    audience: 'all' | 'telegram' | 'web'
  }>
  try {
    const catalog = plansCatalogSql(filter)
    const r = await query<{
      plan_id: string
      title: string
      price_rub: number
      duration_days: number
      audience: 'all' | 'telegram' | 'web'
    }>(catalog.sql, catalog.params)
    rows = r.rows
  } catch (error) {
    if (!isMissingAudienceColumn(error)) throw error
    // Pre-022 schema: shared catalog only (Telegram prices). WEB filter returns empty intentionally.
    if (filter === 'web') {
      rows = []
    } else {
      const r = await query<{
        plan_id: string
        title: string
        price_rub: number
        duration_days: number
      }>(PLANS_CATALOG_SQL_NO_AUDIENCE)
      rows = r.rows.map((row) => ({ ...row, audience: 'all' as const }))
    }
  }
  const sqlMs = Number(process.hrtime.bigint() - started) / 1e6
  sqlTimingLog('plans.list', sqlMs, { rows: rows.length, audience: filter })

  const payload: PlansCatalogPayload = {
    ok: true,
    plans: rows.map((row) => ({
      id: row.plan_id,
      title: row.title,
      priceRub: row.price_rub,
      durationDays: row.duration_days,
      audience: row.audience,
    })),
  }
  const etag = weakEtagFromJson(payload)
  cache.set(payload, etag)
  return { payload, etag, cacheHit: false, sqlMs }
}
