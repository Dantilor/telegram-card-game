/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getCachedInitData, parseAndCacheFromHash } from './telegramInitCache'
import { getInitData } from '../lib/telegram'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { JSDOM } from 'jsdom'

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


  it('restores signed initData in the real vendored Telegram SDK after hash normalization', () => {
    const initData = signedLaunch()
    history.replaceState(null, '', '/telegram-card-game/' + launchHash(initData))
    expect(parseAndCacheFromHash()?.initDataRaw).toBe(initData)
    expect(location.hash).toBe('#/')

    // Execute our actual official Telegram SDK, not a mock. It starts with a
    // normalized hash and must recover the original signed launch from storage.
    const dom = new JSDOM('<!doctype html><html><body></body></html>', {
      url: 'https://example.test/telegram-card-game/#/',
      runScripts: 'outside-only',
    })
    try {
      dom.window.sessionStorage.setItem(SDK_CACHE_KEY, sessionStorage.getItem(SDK_CACHE_KEY)!)
      const sdkSource = readFileSync(resolve(process.cwd(), 'public/telegram-web-app.js'), 'utf8')
      dom.window.eval(sdkSource)
      const sdk = (dom.window as unknown as { Telegram?: { WebApp?: { initData?: string; initDataUnsafe?: { user?: { id?: number } }; version?: string } } }).Telegram?.WebApp
      expect(sdk?.initData).toBe(initData)
      expect(sdk?.initDataUnsafe?.user?.id).toBe(123456789)
      expect(sdk?.version).toBe('9.2')
    } finally {
      dom.window.close()
    }
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
