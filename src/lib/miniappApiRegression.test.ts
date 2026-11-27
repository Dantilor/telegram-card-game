/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiConfigError, resolveApiBase } from './apiBase'
import { getBaseUrl, apiGet } from './api'
import { openWebPromoLink, WEB_PROMO_URL } from '../components/HomeWebPromoCard'

const tgMocks = vi.hoisted(() => ({
  initData: vi.fn<() => string>(),
  waitForInitData: vi.fn<(timeoutMs?: number) => Promise<string>>(),
  openLink: vi.fn<(url: string) => void>(),
}))

vi.mock('./telegram', () => ({
  getInitData: tgMocks.initData,
  getTelegramWebApp: () => ({ openLink: tgMocks.openLink }),
}))
vi.mock('./waitForInitData', () => ({ waitForInitData: tgMocks.waitForInitData }))

describe('Mini App API env guards (938fc40 regression)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('throws api_not_configured when both URL and BASE are empty', () => {
    expect(() => resolveApiBase({})).toThrow(ApiConfigError)
    try {
      resolveApiBase({})
    } catch (e) {
      expect((e as ApiConfigError).code).toBe('api_not_configured')
    }
  })

  it('ignores VITE_API_BASE_URL-shaped objects that omit VITE_API_URL/BASE', () => {
    const env = { VITE_API_BASE_URL: 'https://dantilor-telegram-card-game-3706.twc1.net' } as {
      VITE_API_URL?: string
      VITE_API_BASE?: string
      VITE_API_BASE_URL?: string
    }
    expect(() => resolveApiBase(env)).toThrow(/не задан/)
  })

  it('throws api_base_conflict when URL and BASE differ', () => {
    expect(() =>
      resolveApiBase({
        VITE_API_URL: 'https://dantilor-telegram-card-game-3706.twc1.net',
        VITE_API_BASE: 'https://other.example.test',
      })
    ).toThrow(/разные серверы/)
  })

  it('blocks the legacy Render host', () => {
    expect(() => resolveApiBase({ VITE_API_URL: 'https://telegram-card-game.onrender.com' })).toThrow(/Render/)
  })

  it('accepts identical production URL+BASE', () => {
    const origin = 'https://dantilor-telegram-card-game-3706.twc1.net'
    expect(resolveApiBase({ VITE_API_URL: origin, VITE_API_BASE: origin })).toBe(origin)
  })

  it('getBaseUrl reads import.meta.env VITE_API_URL/BASE only', () => {
    vi.stubEnv('VITE_API_URL', '')
    vi.stubEnv('VITE_API_BASE', '')
    expect(() => getBaseUrl()).toThrow(/не задан/)
    vi.stubEnv('VITE_API_URL', 'https://dantilor-telegram-card-game-3706.twc1.net')
    vi.stubEnv('VITE_API_BASE', 'https://dantilor-telegram-card-game-3706.twc1.net')
    expect(getBaseUrl()).toBe('https://dantilor-telegram-card-game-3706.twc1.net')
  })
})

describe('Mini App public + premium API regression (mocked)', () => {
  const fetchSpy = vi.fn()

  beforeEach(() => {
    fetchSpy.mockReset()
    tgMocks.initData.mockReset().mockReturnValue('')
    tgMocks.waitForInitData.mockReset().mockResolvedValue('')
    tgMocks.openLink.mockReset()
    vi.stubEnv('VITE_API_URL', 'https://api.example.test')
    vi.stubEnv('VITE_API_BASE', 'https://api.example.test')
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('loads /api/plans without Telegram initData and surfaces priceRub', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({
        ok: true,
        plans: [{ id: 'premium_1m', title: 'Premium на 1 месяц', priceRub: 259, durationDays: 30 }],
      }),
    })
    const data = await apiGet<{ ok: boolean; plans: Array<{ priceRub: number }> }>('/api/plans')
    expect(data.plans[0]?.priceRub).toBe(259)
    expect(tgMocks.waitForInitData).not.toHaveBeenCalled()
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe('https://api.example.test/api/plans')
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit
    expect((init.headers as Record<string, string>)['x-telegram-init-data']).toBeUndefined()
  })

  it('loads /api/public-stats without Telegram initData', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ usersCount: 12840 }),
    })
    const data = await apiGet<{ usersCount: number }>('/api/public-stats')
    expect(data.usersCount).toBe(12840)
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe('https://api.example.test/api/public-stats')
  })

  it('sends Telegram initData for /api/premium-status', async () => {
    tgMocks.initData.mockReturnValue('signed-init')
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ ok: true, active: true, planId: 'premium_1m' }),
    })
    const data = await apiGet<{ ok: boolean; active: boolean }>('/api/premium-status')
    expect(data.active).toBe(true)
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit
    expect((init.headers as Record<string, string>)['x-telegram-init-data']).toBe('signed-init')
  })

  it('waits for late Telegram initData before protected premium-status', async () => {
    tgMocks.initData.mockReturnValue('')
    tgMocks.waitForInitData.mockResolvedValue('late-signed')
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ ok: true, active: false }),
    })
    await apiGet('/api/premium-status')
    expect(tgMocks.waitForInitData).toHaveBeenCalled()
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit
    expect((init.headers as Record<string, string>)['x-telegram-init-data']).toBe('late-signed')
  })

  it('opens WEB promo via Telegram.WebApp.openLink', () => {
    openWebPromoLink()
    expect(tgMocks.openLink).toHaveBeenCalledWith(WEB_PROMO_URL)
    expect(WEB_PROMO_URL).toBe('https://play.gamenighthost.ru/')
  })
})
