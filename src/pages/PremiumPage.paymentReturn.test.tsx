/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

const refreshPremium = vi.fn()

vi.mock('../contexts/PremiumContext', () => ({
  usePremium: () => ({
    isPremium: false,
    activeUntil: null,
    loading: false,
    refreshPremium,
  }),
}))
vi.mock('../config/shell', () => ({ isWebShell: () => true }))
vi.mock('../hooks/useBack', () => ({ useBack: () => () => undefined }))
vi.mock('./WebPremiumExperience', () => ({ default: () => <div>plans</div> }))
vi.mock('../components/PremiumOverlay', () => ({ default: () => null }))

function LocationProbe() {
  const location = useLocation()
  return <span data-testid="search">{location.search}</span>
}

async function renderReturn() {
  const PremiumPage = (await import('./PremiumPage')).default
  render(
    <MemoryRouter initialEntries={['/premium?payment=return']}>
      <Routes>
        <Route
          path="/premium"
          element={
            <>
              <PremiumPage />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  )
}

describe('PremiumPage payment return', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    sessionStorage.clear()
    refreshPremium.mockReset()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps polling after ?payment=return is removed until the webhook grant is visible', async () => {
    refreshPremium
      .mockResolvedValueOnce({ isPremium: false })
      .mockResolvedValueOnce({ isPremium: false })
      .mockResolvedValueOnce({ isPremium: true })

    await renderReturn()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(screen.getByTestId('search').textContent).toBe('')
    expect(refreshPremium).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4100)
    })
    expect(refreshPremium).toHaveBeenCalledTimes(3)
    expect(screen.getByText('Premium активирован')).toBeTruthy()
    expect(sessionStorage.getItem('tcg_expecting_payment')).toBeNull()
  })

  it('reports pending payment only after the full polling window', async () => {
    refreshPremium.mockResolvedValue({ isPremium: false })

    await renderReturn()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(screen.getByText('Проверяем оплату…')).toBeTruthy()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(refreshPremium).toHaveBeenCalledTimes(30)
    expect(screen.getByText(/Оплата ещё не подтверждена/)).toBeTruthy()
  })
})