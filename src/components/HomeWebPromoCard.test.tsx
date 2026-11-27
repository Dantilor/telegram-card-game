// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const openLink = vi.fn()

vi.mock('../lib/telegram', () => ({
  getTelegramWebApp: () => ({ openLink }),
}))

vi.mock('../utils/telegram', () => ({
  haptic: vi.fn(),
}))

import HomeWebPromoCard, {
  WEB_PROMO_DISMISS_KEY,
  WEB_PROMO_URL,
  dismissWebPromo,
  isWebPromoDismissed,
  openWebPromoLink,
} from './HomeWebPromoCard'

describe('HomeWebPromoCard', () => {
  beforeEach(() => {
    openLink.mockClear()
    localStorage.clear()
    vi.unstubAllEnvs()
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
    localStorage.clear()
  })

  it('renders the promo with required copy and CTA', () => {
    render(<HomeWebPromoCard />)
    expect(screen.getByRole('heading', { name: /GameNight Host теперь и в браузере/i })).toBeTruthy()
    expect(screen.getByText(/Любимые игры теперь доступны на нашем сайте/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Открыть сайт' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Скрыть' })).toBeTruthy()
  })

  it('opens the WEB site through Telegram.WebApp.openLink', () => {
    render(<HomeWebPromoCard />)
    fireEvent.click(screen.getByRole('button', { name: 'Открыть сайт' }))
    expect(openLink).toHaveBeenCalledWith(WEB_PROMO_URL)
  })

  it('dismisses locally and stays hidden after remount', () => {
    const first = render(<HomeWebPromoCard />)
    fireEvent.click(screen.getByRole('button', { name: 'Скрыть' }))
    expect(isWebPromoDismissed()).toBe(true)
    expect(localStorage.getItem(WEB_PROMO_DISMISS_KEY)).toBe('1')
    expect(screen.queryByRole('heading', { name: /GameNight Host теперь и в браузере/i })).toBeNull()
    first.unmount()
    render(<HomeWebPromoCard />)
    expect(screen.queryByRole('heading', { name: /GameNight Host теперь и в браузере/i })).toBeNull()
  })

  it('does not render in WEB shell builds', () => {
    vi.stubEnv('VITE_GNH_SHELL', 'web')
    render(<HomeWebPromoCard />)
    expect(screen.queryByRole('heading', { name: /GameNight Host теперь и в браузере/i })).toBeNull()
  })

  it('keeps the production WEB URL and remembers dismiss', () => {
    expect(WEB_PROMO_URL).toBe('https://play.gamenighthost.ru/')
    expect(isWebPromoDismissed()).toBe(false)
    dismissWebPromo()
    expect(isWebPromoDismissed()).toBe(true)
  })
})
