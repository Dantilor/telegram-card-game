/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { readPendingWebPayment, savePendingWebPayment } from '../lib/pendingWebPayment'

const refreshPremium = vi.fn()
const confirmWebPayment = vi.fn()
const fetchWebSessionMe = vi.fn()
const navigateSpy = vi.fn()

vi.mock('../contexts/PremiumContext', () => ({
  usePremium: () => ({ isPremium: false, activeUntil: null, loading: false, refreshPremium }),
}))
vi.mock('../config/shell', () => ({ isWebShell: () => true }))
vi.mock('../hooks/useBack', () => ({ useBack: () => () => undefined }))
vi.mock('./WebPremiumExperience', () => ({ default: () => <div>plans</div> }))
vi.mock('../components/PremiumOverlay', () => ({ default: () => null }))
vi.mock('../lib/confirmWebPayment', () => ({ confirmWebPayment: (id: string) => confirmWebPayment(id) }))
vi.mock('../lib/webAuth', () => ({ fetchWebSessionMe: () => fetchWebSessionMe() }))
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateSpy }
})

const PAYMENT = 'pay-12345678'
const ACCOUNT = 'acc-1'
const confirmed = { kind: 'confirmed', activeUntil: '2027-01-01T00:00:00.000Z', alreadyDone: false }

function LocationProbe() {
  return <span data-testid="search">{useLocation().search}</span>
}

async function renderAt(url: string) {
  const PremiumPage = (await import('./PremiumPage')).default
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/premium" element={<><PremiumPage /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>
  )
}

const flush = (ms = 0) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })

describe('PremiumPage automatic payment confirmation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    sessionStorage.clear()
    localStorage.clear()
    refreshPremium.mockReset().mockResolvedValue({ isPremium: true })
    confirmWebPayment.mockReset()
    navigateSpy.mockReset()
    fetchWebSessionMe.mockReset().mockResolvedValue({ ok: true, webAccountId: ACCOUNT, source: 'web_account' })
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('WEB success through confirm before the webhook: Premium shown without reload, order cleared', async () => {
    savePendingWebPayment(PAYMENT, ACCOUNT)
    confirmWebPayment.mockResolvedValue(confirmed)
    await renderAt('/premium?payment=return')
    expect(screen.getByText('Проверяем оплату…')).toBeTruthy()
    expect(screen.queryByText('plans')).toBeNull() // no second checkout while verifying

    await flush(10)
    expect(confirmWebPayment).toHaveBeenCalledWith(PAYMENT)
    expect(refreshPremium).toHaveBeenCalled()
    expect(screen.getByText('Оплата подтверждена!')).toBeTruthy()
    expect(screen.getByTestId('search').textContent).toBe('')
    expect(readPendingWebPayment()).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'К играм' }))
    expect(navigateSpy).toHaveBeenCalledWith('/games')
  })

  it('keeps going after ?payment=return is stripped: pending, pending, succeeded', async () => {
    savePendingWebPayment(PAYMENT, ACCOUNT)
    confirmWebPayment
      .mockResolvedValueOnce({ kind: 'pending', status: 'pending' })
      .mockResolvedValueOnce({ kind: 'pending', status: 'pending' })
      .mockResolvedValueOnce(confirmed)
    await renderAt('/premium?payment=return')
    await flush(0)
    expect(confirmWebPayment).toHaveBeenCalledTimes(1)
    await flush(4100)
    expect(confirmWebPayment).toHaveBeenCalledTimes(3)
    expect(screen.getByText('Оплата подтверждена!')).toBeTruthy()
  })

  it('pending past the limit shows "Платёж ещё обрабатывается"; the button re-checks without a new payment', async () => {
    savePendingWebPayment(PAYMENT, ACCOUNT)
    confirmWebPayment.mockResolvedValue({ kind: 'pending', status: 'pending' })
    await renderAt('/premium?payment=return')
    await flush(65_000)
    expect(confirmWebPayment).toHaveBeenCalledTimes(30)
    expect(screen.getByText('Платёж ещё обрабатывается')).toBeTruthy()
    expect(readPendingWebPayment()?.paymentId).toBe(PAYMENT)

    confirmWebPayment.mockReset().mockResolvedValue(confirmed)
    fireEvent.click(screen.getByRole('button', { name: 'Проверить ещё раз' }))
    await flush(10)
    expect(confirmWebPayment).toHaveBeenCalledWith(PAYMENT)
    expect(screen.getByText('Оплата подтверждена!')).toBeTruthy()
  })

  it('YooKassa API error is temporary: message plus a re-check button', async () => {
    savePendingWebPayment(PAYMENT, ACCOUNT)
    confirmWebPayment.mockResolvedValue({ kind: 'temporary' })
    await renderAt('/premium?payment=return')
    await flush(65_000)
    expect(screen.getByText('Не удалось проверить оплату')).toBeTruthy()
    confirmWebPayment.mockReset().mockResolvedValue(confirmed)
    fireEvent.click(screen.getByRole('button', { name: 'Проверить ещё раз' }))
    await flush(10)
    expect(screen.getByText('Оплата подтверждена!')).toBeTruthy()
  })

  it('reload after the return resumes the check (the URL no longer has ?payment=return)', async () => {
    savePendingWebPayment(PAYMENT, ACCOUNT)
    confirmWebPayment.mockResolvedValue({ kind: 'pending', status: 'pending' })
    const first = await renderAt('/premium?payment=return')
    await flush(10)
    first.unmount()

    confirmWebPayment.mockReset().mockResolvedValue(confirmed)
    await renderAt('/premium')
    await flush(10)
    expect(confirmWebPayment).toHaveBeenCalledWith(PAYMENT)
    expect(screen.getByText('Оплата подтверждена!')).toBeTruthy()
  })

  it('opening /premium with an unfinished checkout (never returned) does not start a check', async () => {
    savePendingWebPayment(PAYMENT, ACCOUNT)
    await renderAt('/premium')
    await flush(10)
    expect(confirmWebPayment).not.toHaveBeenCalled()
    expect(screen.queryByTestId('payment-return')).toBeNull()
    expect(screen.getByText('plans')).toBeTruthy()
  })

  it('lost session (different anonymous account): clear recovery message, no confirm, no new payment', async () => {
    savePendingWebPayment(PAYMENT, ACCOUNT)
    fetchWebSessionMe.mockResolvedValue({ ok: true, webAccountId: 'acc-new-anonymous', source: 'web_account' })
    await renderAt('/premium?payment=return')
    await flush(10)
    expect(confirmWebPayment).not.toHaveBeenCalled()
    expect(refreshPremium).not.toHaveBeenCalled()
    expect(screen.getByText('Не удалось восстановить сессию')).toBeTruthy()
    expect(screen.getByText(/Войдите в аккаунт, с которого совершали покупку/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Войти по email' }))
    expect(navigateSpy).toHaveBeenCalledWith('/login')
    expect(readPendingWebPayment()?.paymentId).toBe(PAYMENT)
  })

  it("someone else's paymentId (server 403) is shown as session recovery and never grants", async () => {
    savePendingWebPayment(PAYMENT, null)
    confirmWebPayment.mockResolvedValue({ kind: 'session_lost' })
    await renderAt('/premium?payment=return')
    await flush(10)
    expect(screen.getByText('Не удалось восстановить сессию')).toBeTruthy()
    expect(refreshPremium).not.toHaveBeenCalled()
  })

  it('no stored order: falls back to waiting for the webhook via /api/me (a8ba4cf behaviour)', async () => {
    refreshPremium
      .mockResolvedValueOnce({ isPremium: false })
      .mockResolvedValueOnce({ isPremium: false })
      .mockResolvedValueOnce({ isPremium: true })
    await renderAt('/premium?payment=return')
    await flush(0)
    expect(screen.getByTestId('search').textContent).toBe('')
    expect(refreshPremium).toHaveBeenCalledTimes(1)
    await flush(4100)
    expect(refreshPremium).toHaveBeenCalledTimes(3)
    expect(confirmWebPayment).not.toHaveBeenCalled()
    expect(screen.getByText('Оплата подтверждена!')).toBeTruthy()
  })

  it('canceled payment offers checkout again', async () => {
    savePendingWebPayment(PAYMENT, ACCOUNT)
    confirmWebPayment.mockResolvedValue({ kind: 'canceled' })
    await renderAt('/premium?payment=return')
    await flush(10)
    expect(screen.getByText('Платёж отменён')).toBeTruthy()
    expect(screen.getByText('plans')).toBeTruthy()
    expect(readPendingWebPayment()).toBeNull()
  })
  it('after a successful payment without a confirmed email offers to link the receipt email', async () => {
    savePendingWebPayment(PAYMENT, ACCOUNT)
    confirmWebPayment.mockResolvedValue(confirmed)
    await renderAt('/premium?payment=return')
    await flush(10)
    expect(screen.getByText(/подтвердите почту из чека в профиле/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Привязать почту' }))
    expect(navigateSpy).toHaveBeenCalledWith('/profile')
  })
})