/**
 * Lightweight in-memory sliding-window rate limiter (single process).
 * Used for OTP / link-code abuse controls alongside DB attempt counters.
 */

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

export function clientIpFromRequest(req: { headers: Record<string, unknown>; ip?: string }): string {
  const xf = req.headers['x-forwarded-for']
  if (typeof xf === 'string' && xf.trim()) {
    return xf.split(',')[0]!.trim().slice(0, 64)
  }
  if (Array.isArray(xf) && typeof xf[0] === 'string') {
    return xf[0].split(',')[0]!.trim().slice(0, 64)
  }
  return (req.ip || 'unknown').slice(0, 64)
}

/** Test helper */
export function resetRateLimitBuckets(): void {
  buckets.clear()
}
