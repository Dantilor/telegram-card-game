/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  initData: vi.fn<() => string>(),
  waitForInitData: vi.fn<(timeoutMs?: number) => Promise<string>>(),
}))

vi.mock('./telegram', () => ({ getInitData: mocks.initData }))
vi.mock('./waitForInitData', () => ({ waitForInitData: mocks.waitForInitData }))
vi.mock('./apiBase', () => ({ resolveApiBase: () => 'https://api.example.test' }))

import { apiGet, apiPost } from './api'

describe('protected API waits for Telegram SDK on quick game launch', () => {
  const fetchSpy = vi.fn(async (_url: string, _init?: RequestInit) => ({
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => ({ ok: true }),
  }))

  beforeEach(() => {
    fetchSpy.mockClear()
    mocks.initData.mockReset().mockReturnValue('')
    mocks.waitForInitData.mockReset().mockResolvedValue('signed-late')
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('waits for a signed Telegram session before a protected game GET', async () => {
    await expect(apiGet('/api/game/rooms')).resolves.toEqual({ ok: true })
    expect(mocks.waitForInitData).toHaveBeenCalledTimes(1)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit
    expect((init.headers as Record<string, string>)['x-telegram-init-data']).toBe('signed-late')
  })

  it('never sends an anonymous POST after SDK timeout', async () => {
    mocks.waitForInitData.mockResolvedValue('')
    await expect(apiPost('/api/payments/create', { plan: 'month' })).rejects.toMatchObject({ status: 401 })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('does not delay or authenticate the public plans GET', async () => {
    await expect(apiGet('/api/plans')).resolves.toEqual({ ok: true })
    expect(mocks.waitForInitData).not.toHaveBeenCalled()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit
    expect((init.headers as Record<string, string>)['x-telegram-init-data']).toBeUndefined()
  })

  it('sends a signed POST exactly once after late SDK startup', async () => {
    await expect(apiPost('/api/game/rooms', { game: 'mafia' })).resolves.toEqual({ ok: true })
    expect(mocks.waitForInitData).toHaveBeenCalledTimes(1)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['x-telegram-init-data']).toBe('signed-late')
  })
})
