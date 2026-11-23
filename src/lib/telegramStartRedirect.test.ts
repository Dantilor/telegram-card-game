/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import {
  isDevicesStartParam,
  isWebLinkStartParam,
  resolveTelegramStartRedirectPath,
} from './telegramStartRedirect'

describe('telegramStartRedirect', () => {
  it('maps wl_ tokens to /link-web once', () => {
    expect(isWebLinkStartParam('wl_abcdefghijklmnopqr')).toBe(true)
    expect(resolveTelegramStartRedirectPath('wl_abcdefghijklmnopqr', '#/')).toBe('/link-web')
    expect(resolveTelegramStartRedirectPath('wl_abcdefghijklmnopqr', '#/link-web')).toBeNull()
  })

  it('maps startapp=devices to /devices and does not bounce when already there', () => {
    expect(isDevicesStartParam('devices')).toBe(true)
    expect(resolveTelegramStartRedirectPath('devices', '#/')).toBe('/devices')
    expect(resolveTelegramStartRedirectPath('devices', '#/devices')).toBeNull()
    expect(resolveTelegramStartRedirectPath('devices', '#/link-web')).toBeNull()
  })

  it('ignores unrelated start params', () => {
    expect(resolveTelegramStartRedirectPath('', '#/')).toBeNull()
    expect(resolveTelegramStartRedirectPath('promo', '#/')).toBeNull()
  })

  it('does not send home hash back to devices after in-app navigation target is open', () => {
    expect(resolveTelegramStartRedirectPath('', '#/')).toBeNull()
    expect(resolveTelegramStartRedirectPath('devices', '#/devices')).toBeNull()
  })
})