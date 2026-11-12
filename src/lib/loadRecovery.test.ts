import { describe, expect, it } from 'vitest'
import { ApiConfigError } from './apiBase'
import { classifyLoadFailure, RECOVERY_DELAYS_MS, recoveryDelayMs } from './loadRecovery'
import { LegalClientError } from '../legal/client'

const withStatus = (status: number, retryAfterMs?: number) =>
  Object.assign(new Error(`API ${status}`), { status, ...(retryAfterMs !== undefined ? { retryAfterMs } : {}) })

describe('classifyLoadFailure', () => {
  it('retries network failures, timeouts, proxy pages and 408/429/5xx', () => {
    expect(classifyLoadFailure(new Error('Сеть недоступна: Failed to fetch')).retryable).toBe(true)
    expect(classifyLoadFailure(new LegalClientError('network', 0, 'Нет соединения')).retryable).toBe(true)
    expect(classifyLoadFailure(new LegalClientError('bad_response', 502, 'proxy page')).retryable).toBe(true)
    for (const status of [408, 429, 500, 502, 503, 504]) {
      expect(classifyLoadFailure(withStatus(status)).retryable).toBe(true)
    }
  })

  it('does not auto-retry configuration errors and permanent 400/401/403/404', () => {
    expect(classifyLoadFailure(new ApiConfigError('api_not_configured', 'нет адреса')).retryable).toBe(false)
    expect(classifyLoadFailure(new LegalClientError('api_base_conflict', 0, 'конфликт')).retryable).toBe(false)
    for (const status of [400, 401, 403, 404]) {
      expect(classifyLoadFailure(withStatus(status)).retryable).toBe(false)
    }
  })

  it('carries Retry-After from 429 responses', () => {
    expect(classifyLoadFailure(withStatus(429, 20_000))).toEqual({ retryable: true, retryAfterMs: 20_000 })
  })
})

describe('recoveryDelayMs', () => {
  it('backs off 2, 4, 8, 15, 30 seconds and then stays at 30 seconds', () => {
    const delays = [1, 2, 3, 4, 5, 6, 9].map((n) => recoveryDelayMs(n, { retryable: true }))
    expect(delays).toEqual([2_000, 4_000, 8_000, 15_000, 30_000, 30_000, 30_000])
    expect(RECOVERY_DELAYS_MS).toEqual([2_000, 4_000, 8_000, 15_000, 30_000])
  })

  it('waits at least the server-requested Retry-After, capped at two minutes', () => {
    expect(recoveryDelayMs(1, { retryable: true, retryAfterMs: 20_000 })).toBe(20_000)
    expect(recoveryDelayMs(5, { retryable: true, retryAfterMs: 1_000 })).toBe(30_000)
    expect(recoveryDelayMs(1, { retryable: true, retryAfterMs: 3_600_000 })).toBe(120_000)
  })
})
