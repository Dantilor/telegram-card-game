/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import {
  formatDeviceLabelFromUa,
  isPlaceholderDeviceLabel,
  resolveDeviceDisplayLabel,
} from './deviceDisplayLabel'

describe('deviceDisplayLabel', () => {
  it('formats common platforms', () => {
    expect(formatDeviceLabelFromUa(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )).toBe('Windows · Chrome')
    expect(formatDeviceLabelFromUa(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    )).toBe('iPhone · Safari')
    expect(formatDeviceLabelFromUa('')).toBe('WEB-устройство')
  })

  it('maps placeholders for current vs other devices', () => {
    expect(isPlaceholderDeviceLabel('Current device')).toBe(true)
    expect(
      resolveDeviceDisplayLabel('Current device', {
        isCurrent: true,
        userAgent:
          'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      })
    ).toBe('Android · Chrome')
    expect(resolveDeviceDisplayLabel('Current device', { isCurrent: false })).toBe('WEB-устройство')
    expect(resolveDeviceDisplayLabel('Windows · Chrome', { isCurrent: true })).toBe('Windows · Chrome')
  })
})