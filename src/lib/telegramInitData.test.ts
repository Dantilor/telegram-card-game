/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('lib/telegram getInitData cache bridge', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.resetModules()
  })

  afterEach(() => {
    sessionStorage.clear()
    Reflect.deleteProperty(window, 'Telegram')
  })

  it('stores WebApp.initData and returns it after WebApp clears initData', async () => {
    const raw =
      'user=%7B%22id%22%3A55%2C%22first_name%22%3A%22A%22%7D&auth_date=1700000000&hash=abcdef0123456789'
    ;(window as Window & { Telegram?: { WebApp: { initData: string; ready?: () => void } } }).Telegram = {
      WebApp: { initData: raw, ready: () => undefined },
    }
    const mod = await import('./telegram')
    expect(mod.getInitData()).toBe(raw)

    ;(window as Window & { Telegram?: { WebApp: { initData: string } } }).Telegram = {
      WebApp: { initData: '' },
    }
    expect(mod.getInitData()).toBe(raw)
  })

  it('ensureInitData waits briefly for late WebApp.initData', async () => {
    const raw =
      'user=%7B%22id%22%3A56%2C%22first_name%22%3A%22B%22%7D&auth_date=1700000000&hash=abcdef0123456789'
    const webApp: { initData: string; ready: () => void } = {
      initData: '',
      ready: () => undefined,
    }
    ;(window as Window & { Telegram?: { WebApp: typeof webApp } }).Telegram = { WebApp: webApp }
    const mod = await import('./telegram')
    setTimeout(() => {
      webApp.initData = raw
    }, 120)
    const got = await mod.ensureInitData(600)
    expect(got).toBe(raw)
  })
})
