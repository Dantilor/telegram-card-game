import type { MeResponse } from './subscription'

/** Module-level me-cache with generation guard against stale in-flight writes. */
let meCache: { data: MeResponse; ts: number; generation: number } | null = null
let mePromise: Promise<MeResponse> | null = null
let meGeneration = 0

export function getMeGeneration(): number {
  return meGeneration
}

export function invalidateMeCache(): void {
  meGeneration += 1
  meCache = null
  mePromise = null
}

export function peekMeCache(ttlMs: number): MeResponse | null {
  if (!meCache) return null
  if (Date.now() - meCache.ts >= ttlMs) return null
  if (meCache.generation !== meGeneration) return null
  return meCache.data
}

export function getMeInFlight(): Promise<MeResponse> | null {
  return mePromise
}

export function setMeInFlight(promise: Promise<MeResponse> | null): void {
  mePromise = promise
}

/** Write cache only if this response still belongs to the current generation. */
export function commitMeCache(data: MeResponse, generation: number): boolean {
  if (generation !== meGeneration) return false
  meCache = { data, ts: Date.now(), generation }
  return true
}

export function clearMeInFlightIfCurrent(promise: Promise<MeResponse>): void {
  if (mePromise === promise) mePromise = null
}
