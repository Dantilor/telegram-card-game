/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const getMe = vi.fn()

vi.mock('../api/subscription', () => ({
  getMe: () => getMe(),
  invalidateMeCache: () => undefined,
  ApiAuthError: class ApiAuthError extends Error {},
}))
vi.mock('../lib/telegram', () => ({ getInitData: () => '' }))
vi.mock('../lib/waitForInitData', () => ({ waitForInitData: async () => '' }))
vi.mock('../lib/telegramSdk', () => ({ subscribeTelegramSdkReady: () => () => undefined }))
vi.mock('../config/shell', () => ({ isWebShell: () => true }))

const ACCOUNT = 'web-account-1'

function seedNotPremiumCache() {
  sessionStorage.setItem('tcg_premium_account', ACCOUNT)
  sessionStorage.setItem(
    `tcg_premium_status:${ACCOUNT}`,
    JSON.stringify({
      data: { isPremium: false, activeUntil: null, isLifetime: false, lastEndedAt: null },
      ts: Date.now(),
      account: ACCOUNT,
    })
  )
}

describe('usePremiumStatus cache after checkout', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    getMe.mockReset()
    getMe.mockResolvedValue({
      webAccountId: ACCOUNT,
      premium: true,
      premiumUntil: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      isLifetime: false,
      lastEndedAt: null,
    })
  })
  afterEach(() => {
    vi.resetModules()
  })

  it('ignores a pre-payment "not Premium" cache while a payment is expected', async () => {
    seedNotPremiumCache()
    sessionStorage.setItem('tcg_expecting_payment', String(Date.now()))
    const { usePremiumStatus } = await import('./usePremiumStatus')

    const { result } = renderHook(() => usePremiumStatus())
    await waitFor(() => expect(result.current.isPremium).toBe(true))
    expect(getMe).toHaveBeenCalled()
    expect(sessionStorage.getItem('tcg_expecting_payment')).toBeNull()
  })

  it('still serves the cache when no payment is expected', async () => {
    seedNotPremiumCache()
    const { usePremiumStatus } = await import('./usePremiumStatus')

    const { result } = renderHook(() => usePremiumStatus())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isPremium).toBe(false)
    expect(getMe).not.toHaveBeenCalled()
  })

  it('does not skip the cache for a stale expectation flag', async () => {
    seedNotPremiumCache()
    sessionStorage.setItem('tcg_expecting_payment', String(Date.now() - 31 * 60 * 1000))
    const { usePremiumStatus } = await import('./usePremiumStatus')

    const { result } = renderHook(() => usePremiumStatus())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(getMe).not.toHaveBeenCalled()
  })
})