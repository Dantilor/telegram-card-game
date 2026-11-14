import { describe, expect, it, vi } from 'vitest'
import { fetchGetWithRetry, parseRetryAfterMs } from './fetchWithRetry'

describe('fetchGetWithRetry', () => {
  it('retries a transient network failure and then succeeds', async () => {
    const fetchImpl = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))

    const response = await fetchGetWithRetry('https://example.com/api/plans', {}, fetchImpl)
    expect(response.status).toBe(200)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(fetchImpl.mock.calls[0]?.[1]?.method).toBe('GET')
  })

  it('retries a transient HTTP 503 but not HTTP 404', async () => {
    const temporarilyUnavailable = vi.fn()
      .mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
    const recovered = await fetchGetWithRetry('https://example.com/api/plans', {}, temporarilyUnavailable)
    expect(recovered.status).toBe(200)
    expect(temporarilyUnavailable).toHaveBeenCalledTimes(2)

    const missingDocument = vi.fn()
      .mockResolvedValueOnce(new Response('missing', { status: 404 }))
    const missing = await fetchGetWithRetry('https://example.com/api/legal/documents/offer', {}, missingDocument)
    expect(missing.status).toBe(404)
    expect(missingDocument).toHaveBeenCalledTimes(1)
  })

  it('refuses non-GET requests to avoid duplicate payment creation', async () => {
    const fetchImpl = vi.fn()
    await expect(fetchGetWithRetry('https://example.com/api/payments/yookassa/create', {
      method: 'POST',
    }, fetchImpl)).rejects.toThrow('GET requests only')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('hands a long Retry-After back to the caller instead of hammering the server', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response('slow down', { status: 429, headers: { 'Retry-After': '20' } }))
    const response = await fetchGetWithRetry('https://example.com/api/plans', {}, fetchImpl)
    expect(response.status).toBe(429)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('parses Retry-After seconds and HTTP dates', () => {
    expect(parseRetryAfterMs('5')).toBe(5_000)
    expect(parseRetryAfterMs(new Date(10_000).toUTCString(), 4_000)).toBe(6_000)
    expect(parseRetryAfterMs('soon')).toBeNull()
    expect(parseRetryAfterMs(null)).toBeNull()
  })

  it('retries HTTP 429 and 502 then returns the successful response', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response('slow down', { status: 429 }))
      .mockResolvedValueOnce(new Response('bad gateway', { status: 502 }))
      .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }))

    const response = await fetchGetWithRetry('https://example.com/api/plans', {}, fetchImpl)
    expect(response.status).toBe(200)
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })
})
