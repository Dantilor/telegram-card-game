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

describe('waitForTelegramStartParam', () => {
  beforeEach(() => {
    vi.resetModules()
    installTg(null)
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

  it('waits for late SDK start_param instead of failing early', async () => {
    const tg: FakeTg = {
      initData: '',
      initDataUnsafe: {},
      ready: () => undefined,
    }
    installTg(tg)
    const { waitForTelegramStartParam } = await import('./telegram')
    const pending = waitForTelegramStartParam(900, 20)
    window.setTimeout(() => {
      tg.initData = 'user=%7B%7D&start_param=wl_late_start_param_ok&hash=x'
      tg.initDataUnsafe = { start_param: 'wl_late_start_param_ok' }
    }, 70)
    await expect(pending).resolves.toBe('wl_late_start_param_ok')
  })
})
