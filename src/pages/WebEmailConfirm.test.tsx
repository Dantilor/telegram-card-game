/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

const completeEmailMagicLink = vi.fn()
const refreshPremium = vi.fn()

vi.mock('../config/shell', () => ({ isWebShell: () => true }))
vi.mock('../lib/webAuth', () => ({ completeEmailMagicLink: (t: string) => completeEmailMagicLink(t) }))
vi.mock('../contexts/PremiumContext', () => ({ usePremium: () => ({ refreshPremium }) }))
vi.mock('../components/HomeButton', () => ({ default: () => null }))

function ProfileProbe() {
  const state = useLocation().state as { emailSyncPhase?: string; emailAuthToast?: string } | null
  return <p data-testid="profile">{`${state?.emailSyncPhase}|${state?.emailAuthToast}`}</p>
}

async function open() {
  const WebEmailConfirm = (await import('./WebEmailConfirm')).default
  render(
    <MemoryRouter initialEntries={['/email/confirm?token=tok_abcdefghijklmnopqrstuvwxyz']}>
      <Routes>
        <Route path="/email/confirm" element={<WebEmailConfirm />} />
        <Route path="/profile" element={<ProfileProbe />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('magic link landing', () => {
  beforeEach(() => {
    completeEmailMagicLink.mockReset().mockResolvedValue({ ok: true, purpose: 'recover' })
    refreshPremium.mockReset()
  })
  afterEach(() => cleanup())

  it('paid account: forces Premium refresh and tells the profile "Premium восстановлен!"', async () => {
    refreshPremium.mockResolvedValue({ isPremium: true })
    await open()
    await waitFor(() => expect(screen.getByTestId('profile').textContent).toBe('restored|Premium восстановлен!'))
    expect(completeEmailMagicLink).toHaveBeenCalledTimes(1)
    expect(refreshPremium).toHaveBeenCalled()
  })

  it('account without Premium: "Аккаунт готов к игре"', async () => {
    refreshPremium.mockResolvedValue({ isPremium: false })
    await open()
    await waitFor(() => expect(screen.getByTestId('profile').textContent).toBe('ready|Аккаунт готов к игре'))
  })

  it('invalid or used link: no navigation, offers a new link', async () => {
    completeEmailMagicLink.mockRejectedValue(Object.assign(new Error('x'), { status: 400 }))
    await open()
    await waitFor(() => expect(screen.getByText(/Ссылка недействительна или уже использована/)).toBeTruthy())
    expect(screen.queryByTestId('profile')).toBeNull()
    expect(refreshPremium).not.toHaveBeenCalled()
  })
})