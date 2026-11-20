import { describe, expect, it } from 'vitest'
import { applyIfCurrent, createSessionApplyGate } from './webSessionStale'

describe('webSessionStale', () => {
  it('ignores refresh results after logout bump', () => {
    const gate = createSessionApplyGate()
    const token = gate.generation
    const applied: unknown[] = []

    gate.bump()
    const ok = applyIfCurrent(gate, token, { webAccountId: 'old' }, (v) => applied.push(v))

    expect(ok).toBe(false)
    expect(applied).toEqual([])
  })

  it('applies refresh when generation is still current', () => {
    const gate = createSessionApplyGate()
    const token = gate.generation
    const applied: unknown[] = []
    const next = { webAccountId: 'a1' }

    const ok = applyIfCurrent(gate, token, next, (v) => applied.push(v))

    expect(ok).toBe(true)
    expect(applied).toEqual([next])
  })

  it('account switch invalidates prior refresh token', () => {
    const gate = createSessionApplyGate()
    const before = gate.generation
    gate.bump()
    expect(gate.isCurrent(before)).toBe(false)
    expect(gate.isCurrent(gate.generation)).toBe(true)
  })
})
