import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  commitMeCache,
  getMeGeneration,
  invalidateMeCache,
  peekMeCache,
  setMeInFlight,
} from './meCache'
import type { MeResponse } from './subscription'

function me(partial: Partial<MeResponse> & Pick<MeResponse, 'premium'>): MeResponse {
  return {
    telegramId: null,
    webAccountId: 'acct-a',
    premiumUntil: null,
    isLifetime: false,
    lastEndedAt: null,
    ...partial,
  }
}

describe('meCache generation guard', () => {
  afterEach(() => {
    invalidateMeCache()
    setMeInFlight(null)
    vi.useRealTimers()
  })

  it('rejects stale commit after invalidateMeCache', () => {
    const gen = getMeGeneration()
    invalidateMeCache()
    const ok = commitMeCache(me({ premium: true, webAccountId: 'old' }), gen)
    expect(ok).toBe(false)
    expect(peekMeCache(5000)).toBeNull()
  })

  it('accepts commit for current generation', () => {
    const gen = getMeGeneration()
    const data = me({ premium: true, webAccountId: 'acct-b', premiumUntil: '2026-12-20T00:00:00.000Z' })
    expect(commitMeCache(data, gen)).toBe(true)
    expect(peekMeCache(5000)).toEqual(data)
  })

  it('delayed response from previous account cannot rewrite cache after account switch', async () => {
    const genA = getMeGeneration()
    let resolveA!: (v: MeResponse) => void
    const delayedA = new Promise<MeResponse>((resolve) => {
      resolveA = resolve
    })

    setMeInFlight(delayedA)

    invalidateMeCache()
    const genB = getMeGeneration()
    expect(genB).toBeGreaterThan(genA)

    const dataB = me({ premium: false, webAccountId: 'acct-b' })
    expect(commitMeCache(dataB, genB)).toBe(true)
    expect(peekMeCache(5000)?.webAccountId).toBe('acct-b')
    expect(peekMeCache(5000)?.premium).toBe(false)

    const dataA = me({ premium: true, webAccountId: 'acct-a', premiumUntil: '2099-01-01T00:00:00.000Z' })
    resolveA(dataA)
    await delayedA
    expect(commitMeCache(dataA, genA)).toBe(false)
    expect(peekMeCache(5000)?.webAccountId).toBe('acct-b')
    expect(peekMeCache(5000)?.premium).toBe(false)
  })
})
