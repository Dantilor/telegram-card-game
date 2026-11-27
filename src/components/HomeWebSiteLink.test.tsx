/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import HomeWebSiteLink from './HomeWebSiteLink'
import { WEB_PROMO_URL } from './HomeWebPromoCard'

const openLink = vi.fn()

vi.mock('../lib/telegram', () => ({
  getTelegramWebApp: () => ({ openLink }),
}))

vi.mock('../utils/telegram', () => ({
  haptic: vi.fn(),
}))

describe('HomeWebSiteLink', () => {
  beforeEach(() => {
    openLink.mockReset()
    vi.stubEnv('VITE_GNH_SHELL', '')
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
  })

  it('renders permanent site link under hero CTA', () => {
    render(<HomeWebSiteLink />)
    expect(screen.getByRole('button', { name: 'Играть на сайте' })).toBeTruthy()
    expect(screen.getByText('Играть на сайте')).toBeTruthy()
  })

  it('opens WEB via openWebPromoLink / Telegram openLink', () => {
    render(<HomeWebSiteLink />)
    fireEvent.click(screen.getByRole('button', { name: 'Играть на сайте' }))
    expect(openLink).toHaveBeenCalledWith(WEB_PROMO_URL)
  })

  it('hides in WEB shell builds', () => {
    vi.stubEnv('VITE_GNH_SHELL', 'web')
    const { container } = render(<HomeWebSiteLink />)
    expect(container.firstChild).toBeNull()
  })
})
