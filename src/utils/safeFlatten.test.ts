import { describe, it, expect } from 'vitest'
import { safeFlatten, toArray } from './safeFlatten'

describe('safeFlatten', () => {
  it('returns empty array for null/undefined', () => {
    expect(safeFlatten(null)).toEqual([])
    expect(safeFlatten(undefined)).toEqual([])
  })

  it('flattens nested arrays', () => {
    expect(safeFlatten([1, [2, 3], [4]])).toEqual([1, 2, 3, 4])
  })

  it('returns empty array for non-iterable primitives', () => {
    expect(safeFlatten(42)).toEqual([])
    expect(safeFlatten({})).toEqual([])
  })

  it('handles iterables', () => {
    expect(safeFlatten(new Set([1, 2]))).toEqual([1, 2])
  })

  it('skips null/undefined in arrays', () => {
    expect(safeFlatten([1, null, undefined, 2])).toEqual([1, 2])
  })
})

describe('toArray', () => {
  it('returns empty for null/undefined', () => {
    expect(toArray(null)).toEqual([])
    expect(toArray(undefined)).toEqual([])
  })

  it('returns array as-is', () => {
    expect(toArray([1, 2, 3])).toEqual([1, 2, 3])
  })

  it('wraps single value', () => {
    expect(toArray(42)).toEqual([42])
  })

  it('handles iterables', () => {
    expect(toArray(new Set([1, 2]))).toEqual([1, 2])
  })
})
