// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildLoadTimingReport,
  isLoadTimingEnabled,
  markLoadTiming,
  publishLoadTimingReport,
} from './loadTiming'

describe('loadTiming', () => {
  afterEach(() => {
    vi.useRealTimers()
    delete window.__GNH_PERF__
    delete window.__GNH_PERF_MARKS__
    delete window.__GNH_PERF_META__
    try {
      localStorage.removeItem('gnh_perf')
    } catch {
      // ignore
    }
  })

  it('enables only via explicit flag', () => {
    expect(isLoadTimingEnabled('')).toBe(false)
    expect(isLoadTimingEnabled('?gnh_perf=1')).toBe(true)
    expect(isLoadTimingEnabled('?foo=1&gnh_perf=1')).toBe(true)
  })

  it('builds a report without query strings or secret-looking fields', () => {
    const report = buildLoadTimingReport('manual')
    expect(report.page.path).toBeTypeOf('string')
    expect(report.snapshot).toBe('manual')
    expect(typeof report.snapshotAtMs).toBe('number')
    expect(JSON.stringify(report)).not.toMatch(/initData|auth_date|hash=|password|Bearer/i)
    expect(report.totals).toMatchObject({
      networkWaitMs: expect.any(Number),
      resourceDownloadMs: expect.any(Number),
      jsParseApproxMs: expect.any(Number),
      apiWaitMs: expect.any(Number),
      transferredBytes: expect.any(Number),
    })
  })

  it('publishes early/mid/late snapshots for long cold starts', () => {
    vi.useFakeTimers()
    localStorage.setItem('gnh_perf', '1')
    const stop = publishLoadTimingReport([100, 200, 300])
    expect(window.__GNH_PERF__).toBeUndefined()
    vi.advanceTimersByTime(100)
    expect(window.__GNH_PERF__?.snapshot).toBe('early')
    vi.advanceTimersByTime(100)
    expect(window.__GNH_PERF__?.snapshot).toBe('mid')
    vi.advanceTimersByTime(100)
    expect(window.__GNH_PERF__?.snapshot).toBe('late')
    stop()
  })

  it('marks ui-interactive only after home-visible and a real user input', () => {
    vi.useFakeTimers()
    localStorage.setItem('gnh_perf', '1')
    const stop = publishLoadTimingReport([10_000])
    expect(window.__GNH_PERF_MARKS__?.['ui-interactive']).toBeUndefined()
    window.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(window.__GNH_PERF_MARKS__?.['ui-interactive']).toBeUndefined()
    markLoadTiming('home-visible')
    window.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(window.__GNH_PERF_MARKS__?.['ui-interactive']).toEqual(expect.any(Number))
    expect(window.__GNH_PERF_META__?.interactiveSource).toBe('first-input')
    stop()
  })
})
