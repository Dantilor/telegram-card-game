/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest'

type FakeTg = {
  initData: string
  initDataUnsafe: { start_param?: string }
  ready?: () => void
}

function installTg(tg: FakeTg | null) {
  Object.defineProperty(window, 'Telegram', {
    configurable: true,
    value: tg ? { WebApp: tg } : undefined,
  })
}

describe('telegram startapp helpers', () => {
  beforeEach(() => {
    vi.resetModules()
    installTg(null)
    window.history.replaceState(null, '', '/telegram-card-game/')
    try {
      sessionStorage.clear()
    } catch {
      /* ignore */
    }
  })

  it('returns immediately when start_param is already present', async () => {
    installTg({
      initData: 'user=%7B%7D&start_param=wl_abcdefghijklmnopqr&hash=x',
      initDataUnsafe: { start_param: 'wl_abcdefghijklmnopqr' },
      ready: () => undefined,
    })
    const { waitForTelegramStartParam } = await import('./telegram')
    await expect(waitForTelegramStartParam(400, 20)).resolves.toBe('wl_abcdefghijklmnopqr')
  })

  it('reads tgWebAppStartParam from the query string when initData has no start_param', async () => {
    installTg({
      initData: 'user=%7B%7D&auth_date=1&hash=x',
      initDataUnsafe: {},
      ready: () => undefined,
    })
    window.history.replaceState(
      null,
      '',
      '/telegram-card-game/?tgWebAppStartParam=wl_from_query_string_ok'
    )
    const { getTelegramStartParam } = await import('./telegram')
    expect(getTelegramStartParam()).toBe('wl_from_query_string_ok')
  })

  it('reads tgWebAppStartParam preserved in Telegram SDK initParams storage', async () => {
    installTg({
      initData: '',
      initDataUnsafe: {},
      ready: () => undefined,
    })
    sessionStorage.setItem(
      '__telegram__initParams',
      JSON.stringify({ tgWebAppStartParam: 'wl_from_sdk_store_token' })
    )
    const { getTelegramStartParam } = await import('./telegram')
    expect(getTelegramStartParam()).toBe('wl_from_sdk_store_token')
  })
})
