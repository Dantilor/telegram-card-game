import { describe, expect, it } from 'vitest'
import { buildLoadTimingReport, isLoadTimingEnabled } from './loadTiming'

describe('loadTiming', () => {
  it('enables only via explicit flag', () => {
    expect(isLoadTimingEnabled('')).toBe(false)
    expect(isLoadTimingEnabled('?gnh_perf=1')).toBe(true)
    expect(isLoadTimingEnabled('?foo=1&gnh_perf=1')).toBe(true)
  })

  it('builds a report without query strings or secret-looking fields', () => {
    const report = buildLoadTimingReport()
    expect(report.page.path).toBeTypeOf('string')
    expect(JSON.stringify(report)).not.toMatch(/initData|auth_date|hash=|password|Bearer/i)
    expect(report.totals).toMatchObject({
      networkWaitMs: expect.any(Number),
      resourceDownloadMs: expect.any(Number),
      jsParseApproxMs: expect.any(Number),
      apiWaitMs: expect.any(Number),
      transferredBytes: expect.any(Number),
    })
  })
})
