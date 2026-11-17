/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getCachedInitData, parseAndCacheFromHash } from './telegramInitCache'
import { getInitData } from '../lib/telegram'

const SDK_CACHE_KEY = '__telegram__initParams'

function launchHash(rawInitData: string): string {
  return (
    '#tgWebAppData=' + encodeURIComponent(rawInitData) +
    '&tgWebAppVersion=9.2' +
    '&tgWebAppPlatform=android' +
    '&tgWebAppThemeParams=' + encodeURIComponent(JSON.stringify({ bg_color: '#123456' }))
  )
}

function signedLaunch(): string {
  const user = JSON.stringify({ id: 123456789, first_name: 'Тест & 100%', username: 'gnh_test' })
  return new URLSearchParams({
    query_id: 'AAEAA',
    user,
    auth_date: '1790000000',
    hash: 'aabbccddee',
  }).toString()
}

describe('Telegram launch capture before async SDK', () => {
  beforeEach(() => {
    sessionStorage.clear()
    history.replaceState(null, '', '/telegram-card-game/')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    sessionStorage.clear()
    history.replaceState(null, '', '/telegram-card-game/')
  })

  it('keeps exact signed initData and SDK launch metadata while normalizing the route', () => {
    const initData = signedLaunch()
    history.replaceState(null, '', '/telegram-card-game/?gnh_perf=1' + launchHash(initData))

    const captured = parseAndCacheFromHash()
    expect(captured?.initDataRaw).toBe(initData)
    expect(captured?.userId).toBe(123456789)
    expect(captured?.user?.first_name).toBe('Тест & 100%')
    expect(getCachedInitData()?.initDataRaw).toBe(initData)
    expect(getInitData()).toBe(initData)
    expect(location.pathname + location.search + location.hash).toBe('/telegram-card-game/?gnh_perf=1#/')

    // The vendored Telegram SDK reads this exact key if the launch hash was
    // already normalized before its async script executed.
    const sdkParams = JSON.parse(sessionStorage.getItem(SDK_CACHE_KEY) || '{}')
    expect(sdkParams.tgWebAppData).toBe(initData)
    expect(sdkParams.tgWebAppVersion).toBe('9.2')
    expect(sdkParams.tgWebAppPlatform).toBe('android')
    expect(JSON.parse(sdkParams.tgWebAppThemeParams).bg_color).toBe('#123456')
  })

  it('overwrites an older SDK launch, never authenticating from stale params', () => {
    sessionStorage.setItem(SDK_CACHE_KEY, JSON.stringify({
      tgWebAppData: 'stale',
      tgWebAppVersion: '6.0',
    }))
    const initData = signedLaunch()
    history.replaceState(null, '', '/telegram-card-game/' + launchHash(initData))

    expect(parseAndCacheFromHash()?.initDataRaw).toBe(initData)
    const sdkParams = JSON.parse(sessionStorage.getItem(SDK_CACHE_KEY) || '{}')
    expect(sdkParams.tgWebAppData).toBe(initData)
    expect(sdkParams.tgWebAppVersion).toBe('9.2')
  })

  it('retains the original hash if sessionStorage cannot be written', () => {
    const initData = signedLaunch()
    const hash = launchHash(initData)
    history.replaceState(null, '', '/telegram-card-game/' + hash)
    const original = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key: string, value: string) {
      if (key === SDK_CACHE_KEY) throw new Error('Storage disabled')
      return original.call(this, key, value)
    })

    expect(parseAndCacheFromHash()).toBeNull()
    expect(location.hash).toBe(hash)
  })

  it('does not overwrite ordinary HashRouter routes', () => {
    history.replaceState(null, '', '/telegram-card-game/#/games')
    expect(parseAndCacheFromHash()).toBeNull()
    expect(location.hash).toBe('#/games')
    expect(sessionStorage.getItem(SDK_CACHE_KEY)).toBeNull()
  })
})
