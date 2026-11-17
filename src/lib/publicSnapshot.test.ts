/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isPublicPlansLabel, isPublicUserCount, readPublicSnapshot, writePublicSnapshot } from './publicSnapshot'

describe('Home public snapshot cache', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-17T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it('shows a previously server-confirmed count instantly but expires it', () => {
    writePublicSnapshot('user-count', 18432)
    expect(readPublicSnapshot('user-count', 600_000, isPublicUserCount)).toBe(18432)
    vi.setSystemTime(new Date('2026-11-17T12:11:00Z'))
    expect(readPublicSnapshot('user-count', 600_000, isPublicUserCount)).toBeNull()
  })

  it('shows recent plan preview, rejects fabricated/malformed labels', () => {
    writePublicSnapshot('plans-label', 'от 259 ₽')
    expect(readPublicSnapshot('plans-label', 300_000, isPublicPlansLabel)).toBe('от 259 ₽')
    writePublicSnapshot('plans-label', '<script>alert(1)</script>')
    expect(readPublicSnapshot('plans-label', 300_000, isPublicPlansLabel)).toBeNull()
  })

  it('rejects invalid counts and does not substitute a fake number', () => {
    writePublicSnapshot('user-count', -1)
    expect(readPublicSnapshot('user-count', 600_000, isPublicUserCount)).toBeNull()
  })
})
