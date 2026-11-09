/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  cacheInitDataFromWebApp,
  getCachedInitData,
  parseAndCacheFromHash,
} from './telegramInitCache'

function signedLikeInitData(userId = 42): string {
  const user = encodeURIComponent(JSON.stringify({ id: userId, first_name: 'T' }))
  return `user=${user}&auth_date=1700000000&hash=deadbeefcafebabe`
}

describe('telegramInitCache', () => {
  beforeEach(() => {
    sessionStorage.clear()
    window.location.hash = ''
  })

  afterEach(() => {
    sessionStorage.clear()
    window.location.hash = ''
  })

  it('caches WebApp initData for later empty Telegram.WebApp.initData', () => {
    const raw = signedLikeInitData(7)
    const cached = cacheInitDataFromWebApp(raw)
    expect(cached?.initDataRaw).toContain('auth_date=')
    expect(cached?.userId).toBe(7)
    expect(getCachedInitData()?.initDataRaw).toBe(cached?.initDataRaw)
  })

  it('rejects unsigned / empty payloads', () => {
    expect(cacheInitDataFromWebApp('')).toBeNull()
    expect(cacheInitDataFromWebApp('user=%7B%22id%22%3A1%7D')).toBeNull()
    expect(getCachedInitData()).toBeNull()
  })

  it('hash parse still caches and normalizes', () => {
    const raw = signedLikeInitData(9)
    window.location.hash = `#tgWebAppData=${encodeURIComponent(raw)}`
    const cached = parseAndCacheFromHash()
    expect(cached?.userId).toBe(9)
    expect(getCachedInitData()?.initDataRaw).toBeTruthy()
    expect(window.location.hash).toBe('#/')
  })
})
