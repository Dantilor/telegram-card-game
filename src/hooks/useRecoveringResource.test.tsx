// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRecoveringResource } from './useRecoveringResource'

const networkError = () => Object.assign(new Error('Сеть недоступна: Failed to fetch'), {})
const httpError = (status: number, retryAfterMs?: number) =>
  Object.assign(new Error(`API ${status}`), { status, ...(retryAfterMs !== undefined ? { retryAfterMs } : {}) })

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
  document.dispatchEvent(new Event('visibilitychange'))
}

async function flush() {
  await act(async () => { await Promise.resolve() })
}

async function advance(ms: number) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms) })
}

beforeEach(() => {
  vi.useFakeTimers()
  setVisibility('visible')
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useRecoveringResource', () => {
  it('keeps recovering with growing pauses and stops after success', async () => {
    const load = vi.fn()
      .mockRejectedValueOnce(networkError())
      .mockRejectedValueOnce(httpError(503))
      .mockRejectedValueOnce(networkError())
      .mockResolvedValueOnce(['premium_1m'])
    const { result } = renderHook(() => useRecoveringResource(true, load))
    await flush()
    expect(load).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe('recovering')

    await advance(1_999)
    expect(load).toHaveBeenCalledTimes(1)
    await advance(1)
    expect(load).toHaveBeenCalledTimes(2)

    await advance(4_000)
    expect(load).toHaveBeenCalledTimes(3)

    await advance(8_000)
    expect(load).toHaveBeenCalledTimes(4)
    expect(result.current.status).toBe('ready')
    expect(result.current.data).toEqual(['premium_1m'])

    await advance(120_000)
    expect(load).toHaveBeenCalledTimes(4)
  })

  it('never runs two requests for the same resource at once', async () => {
    let finish: (value: string) => void = () => undefined
    const load = vi.fn(() => new Promise<string>((resolve) => { finish = resolve }))
    const { result } = renderHook(() => useRecoveringResource(true, load))
    await flush()
    act(() => { result.current.retryNow() })
    window.dispatchEvent(new Event('online'))
    setVisibility('visible')
    expect(load).toHaveBeenCalledTimes(1)
    await act(async () => { finish('ok') })
    expect(result.current.status).toBe('ready')
  })

  it('does not auto-retry a permanent 404 until the user asks', async () => {
    const load = vi.fn().mockRejectedValueOnce(httpError(404)).mockResolvedValueOnce('doc')
    const { result } = renderHook(() => useRecoveringResource(true, load))
    await flush()
    expect(result.current.status).toBe('failed')
    await advance(300_000)
    expect(load).toHaveBeenCalledTimes(1)
    act(() => { result.current.retryNow() })
    await flush()
    expect(load).toHaveBeenCalledTimes(2)
    expect(result.current.status).toBe('ready')
  })

  it('pauses while the app is hidden and checks again on return', async () => {
    const load = vi.fn().mockRejectedValueOnce(networkError()).mockResolvedValueOnce('ok')
    const { result } = renderHook(() => useRecoveringResource(true, load))
    await flush()
    act(() => setVisibility('hidden'))
    await advance(60_000)
    expect(load).toHaveBeenCalledTimes(1)
    act(() => setVisibility('visible'))
    await flush()
    expect(load).toHaveBeenCalledTimes(2)
    expect(result.current.status).toBe('ready')
  })

  it('retries at once when the network comes back, without waiting for the timer', async () => {
    const load = vi.fn().mockRejectedValueOnce(networkError()).mockResolvedValueOnce('ok')
    const { result } = renderHook(() => useRecoveringResource(true, load))
    await flush()
    act(() => { window.dispatchEvent(new Event('online')) })
    await flush()
    expect(load).toHaveBeenCalledTimes(2)
    expect(result.current.status).toBe('ready')
  })

  it('honors Retry-After from HTTP 429', async () => {
    const load = vi.fn().mockRejectedValueOnce(httpError(429, 20_000)).mockResolvedValueOnce('ok')
    renderHook(() => useRecoveringResource(true, load))
    await flush()
    await advance(19_999)
    expect(load).toHaveBeenCalledTimes(1)
    await advance(1)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('aborts the request and clears timers when the screen closes', async () => {
    let signal: AbortSignal | undefined
    const load = vi.fn((s: AbortSignal) => { signal = s; return new Promise<string>(() => undefined) })
    const { rerender } = renderHook(({ open }) => useRecoveringResource(open, load), { initialProps: { open: true } })
    await flush()
    rerender({ open: false })
    expect(signal?.aborted).toBe(true)
    await advance(300_000)
    expect(load).toHaveBeenCalledTimes(1)
  })
})
