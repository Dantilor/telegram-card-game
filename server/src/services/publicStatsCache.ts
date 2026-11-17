import { query } from '../db.js'
import { createPublicTtlCache } from './publicCache.js'
import { sqlTimingLog } from '../middleware/requestTiming.js'

type PublicStatsPayload = { usersCount: number }

const TTL_MS = 60_000
const cache = createPublicTtlCache<PublicStatsPayload>(TTL_MS)

export async function getPublicStats(): Promise<{ payload: PublicStatsPayload; cacheHit: boolean }> {
  const hit = cache.get()
  if (hit) return { payload: hit.value, cacheHit: true }

  const started = process.hrtime.bigint()
  const r = await query<{ users_count: number }>('SELECT COUNT(*)::int AS users_count FROM users')
  const sqlMs = Number(process.hrtime.bigint() - started) / 1e6
  sqlTimingLog('public-stats.count', sqlMs)

  const payload = { usersCount: r.rows[0]?.users_count ?? 0 }
  cache.set(payload, `stats-${payload.usersCount}`)
  return { payload, cacheHit: false }
}
