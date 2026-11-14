/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { afterCriticalImages, scheduleIdleImports, scheduleWhenIdle } from './scheduleWhenIdle'

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

  it('waits for high-priority first-screen images before optional downloads', () => {
    vi.useFakeTimers()
    const img = document.createElement('img')
    img.setAttribute('fetchpriority', 'high')
    let complete = false
    Object.defineProperty(img, 'complete', { configurable: true, get: () => complete })
    document.body.appendChild(img)
    const task = vi.fn()
    afterCriticalImages(task, 8000)
    vi.advanceTimersByTime(5000)
    expect(task).not.toHaveBeenCalled()
    complete = true
    img.dispatchEvent(new Event('load'))
    expect(task).toHaveBeenCalledTimes(1)
    img.remove()
  })

  it('does not wait forever for a stuck hero image', () => {
    vi.useFakeTimers()
    const img = document.createElement('img')
    img.setAttribute('fetchpriority', 'high')
    Object.defineProperty(img, 'complete', { configurable: true, get: () => false })
    document.body.appendChild(img)
    const task = vi.fn()
    afterCriticalImages(task, 8000)
    vi.advanceTimersByTime(8000)
    expect(task).toHaveBeenCalledTimes(1)
    img.remove()
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
