// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/telegram', () => ({
  getTelegramWebApp: () => null,
}))

vi.mock('../utils/telegram', () => ({
  haptic: vi.fn(),
}))

import { WEB_PROMO_URL, openWebPromoLink } from './HomeWebPromoCard'

describe('openWebPromoLink fallback', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses window.open when Telegram WebApp API is unavailable', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window)
    openWebPromoLink()
    expect(openSpy).toHaveBeenCalledWith(WEB_PROMO_URL, '_blank', 'noopener,noreferrer')
  })
})

