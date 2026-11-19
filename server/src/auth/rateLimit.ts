/**
 * Rate limiter: in-memory (single process) + optional Postgres buckets (multi-instance).
 * IP identity must come from Express `req.ip` when trust proxy is configured —
 * never trust a client-supplied X-Forwarded-For alone.
 */

import type { Queryable } from '../legal/types.js'
import { query as defaultQuery } from '../db.js'

type Bucket = { timestamps: number[] }

const buckets = new Map<string, Bucket>()

export function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: true } | { ok: false; retryAfterMs: number } {
  const now = Date.now()
  const bucket = buckets.get(key) ?? { timestamps: [] }
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs)
  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0] ?? now
    buckets.set(key, bucket)
    return { ok: false, retryAfterMs: Math.max(0, windowMs - (now - oldest)) }
  }
  bucket.timestamps.push(now)
  buckets.set(key, bucket)
  return { ok: true }
}

/**
 * Prefer Express-resolved `req.ip` (respects `trust proxy`).
 * Do not invent identity from a raw X-Forwarded-For header.
 */
export function clientIpFromRequest(req: {
  ip?: string
  socket?: { remoteAddress?: string }
}): string {
  const ip = (req.ip || req.socket?.remoteAddress || 'unknown').trim()
  return ip.slice(0, 64) || 'unknown'
}

/**
 * Atomic sliding window in Postgres for multi-instance deployments.
 * Falls back to memory if the table is not yet migrated.
 */
export async function consumeSharedRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  customDb?: Queryable
): Promise<{ ok: true } | { ok: false; retryAfterMs: number }> {
  const now = new Date()
  const windowStartIso = new Date(now.getTime() - windowMs).toISOString()
  const db = customDb ?? {
    query: async <T>(sql: string, params?: unknown[]) => {
      const result = await defaultQuery(sql, params)
      return { rows: result.rows as T[] }
    },
  }

  try {
    const result = await db.query<{ hit_count: number; window_started_at: Date }>(
      `INSERT INTO web_rate_buckets (bucket_key, window_started_at, hit_count, updated_at)
       VALUES ($1, now(), 1, now())
       ON CONFLICT (bucket_key) DO UPDATE SET
         window_started_at = CASE
           WHEN web_rate_buckets.window_started_at < $2::timestamptz THEN now()
           ELSE web_rate_buckets.window_started_at
         END,
         hit_count = CASE
           WHEN web_rate_buckets.window_started_at < $2::timestamptz THEN 1
           ELSE web_rate_buckets.hit_count + 1
         END,
         updated_at = now()
       RETURNING hit_count, window_started_at`,
      [key.slice(0, 200), windowStartIso]
    )
    const row = result.rows[0]
    if (!row) return consumeRateLimit(key, limit, windowMs)
    if (row.hit_count > limit) {
      const started = new Date(row.window_started_at).getTime()
      return { ok: false, retryAfterMs: Math.max(0, windowMs - (Date.now() - started)) }
    }
    return { ok: true }
  } catch {
    // Table missing (pre-018) or transient DB error — degrade to process-local limiter.
    return consumeRateLimit(key, limit, windowMs)
  }
}

/** Test helper */
export function resetRateLimitBuckets(): void {
  buckets.clear()
}
