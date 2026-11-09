/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { scheduleIdleImports, scheduleWhenIdle } from './scheduleWhenIdle'

describe('scheduleWhenIdle', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('falls back to setTimeout when requestIdleCallback is missing', () => {
    vi.useFakeTimers()
    vi.stubGlobal('requestIdleCallback', undefined)
    const task = vi.fn()
    scheduleWhenIdle(task, 900)
    expect(task).not.toHaveBeenCalled()
    vi.advanceTimersByTime(900)
    expect(task).toHaveBeenCalledTimes(1)
  })

  it('loads dynamic imports one by one instead of in parallel', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('requestIdleCallback', undefined)

    const order: number[] = []
    const importers = [0, 1, 2].map((n) =>
      vi.fn(async () => {
        order.push(n)
      })
    )

    scheduleIdleImports(importers, { startDelayMs: 100, gapMs: 50, timeoutMs: 100 })

    await vi.advanceTimersByTimeAsync(100)
    await vi.advanceTimersByTimeAsync(100)
    expect(importers[0]).toHaveBeenCalledTimes(1)
    expect(importers[1]).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(50)
    await vi.advanceTimersByTimeAsync(100)
    expect(importers[1]).toHaveBeenCalledTimes(1)
    expect(importers[2]).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(50)
    await vi.advanceTimersByTimeAsync(100)
    expect(order).toEqual([0, 1, 2])
  })
})
