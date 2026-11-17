/**
 * Tiny in-process TTL cache for public, non-personal catalog payloads.
 * Never use for /api/me, premium, legal/me, rooms, or payments.
 */

export type PublicCacheEntry<T> = {
  value: T
  expiresAt: number
  createdAt: number
  etag: string
}

export function createPublicTtlCache<T>(ttlMs: number) {
  let entry: PublicCacheEntry<T> | null = null

  return {
    ttlMs,
    get(): PublicCacheEntry<T> | null {
      if (!entry) return null
      if (Date.now() >= entry.expiresAt) {
        entry = null
        return null
      }
      return entry
    },
    set(value: T, etag: string): PublicCacheEntry<T> {
      const createdAt = Date.now()
      entry = {
        value,
        etag,
        createdAt,
        expiresAt: createdAt + ttlMs,
      }
      return entry
    },
    clear(): void {
      entry = null
    },
  }
}

export function weakEtagFromJson(payload: unknown): string {
  const raw = typeof payload === 'string' ? payload : JSON.stringify(payload)
  let hash = 2166136261
  for (let i = 0; i < raw.length; i += 1) {
    hash ^= raw.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return `W/"${(hash >>> 0).toString(16)}-${raw.length}"`
}
