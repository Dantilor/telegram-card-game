import { query } from '../db.js'
import { createPublicTtlCache, weakEtagFromJson } from './publicCache.js'
import { sqlTimingLog } from '../middleware/requestTiming.js'

export type PublicPlan = {
  id: string
  title: string
  priceRub: number
  durationDays: number
}

export type PlansCatalogPayload = {
  ok: true
  plans: PublicPlan[]
}

const TTL_MS = 30_000
const cache = createPublicTtlCache<PlansCatalogPayload>(TTL_MS)

export function clearPlansCatalogCache(): void {
  cache.clear()
}

export async function getPlansCatalog(): Promise<{
  payload: PlansCatalogPayload
  etag: string
  cacheHit: boolean
  sqlMs: number | null
}> {
  const hit = cache.get()
  if (hit) {
    return { payload: hit.value, etag: hit.etag, cacheHit: true, sqlMs: null }
  }

  const started = process.hrtime.bigint()
  const r = await query<{ plan_id: string; title: string; price_rub: number; duration_days: number }>(
    `SELECT plan_id, title, price_rub, duration_days
     FROM plans WHERE is_active = true
     ORDER BY duration_days ASC, price_rub ASC`
  )
  const sqlMs = Number(process.hrtime.bigint() - started) / 1e6
  sqlTimingLog('plans.list', sqlMs, { rows: r.rows.length })

  const payload: PlansCatalogPayload = {
    ok: true,
    plans: r.rows.map((row) => ({
      id: row.plan_id,
      title: row.title,
      priceRub: row.price_rub,
      durationDays: row.duration_days,
    })),
  }
  const etag = weakEtagFromJson(payload)
  cache.set(payload, etag)
  return { payload, etag, cacheHit: false, sqlMs }
}
