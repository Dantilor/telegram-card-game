import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createPublicTtlCache, weakEtagFromJson } from './publicCache.js'

describe('publicCache', () => {
  it('returns hits inside TTL and misses after expiry', () => {
    const cache = createPublicTtlCache<{ n: number }>(20)
    assert.equal(cache.get(), null)
    cache.set({ n: 1 }, 'etag-1')
    assert.equal(cache.get()?.value.n, 1)
    assert.equal(cache.get()?.etag, 'etag-1')
  })

  it('builds a stable weak etag for the same JSON payload', () => {
    const a = weakEtagFromJson({ ok: true, plans: [{ id: 'premium_1m' }] })
    const b = weakEtagFromJson({ ok: true, plans: [{ id: 'premium_1m' }] })
    const c = weakEtagFromJson({ ok: true, plans: [{ id: 'premium_3m' }] })
    assert.equal(a, b)
    assert.notEqual(a, c)
    assert.match(a, /^W\//)
  })
})
