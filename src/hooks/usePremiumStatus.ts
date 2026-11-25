import { useState, useEffect, useCallback, useRef } from 'react'
import { getInitData } from '../lib/telegram'
import { waitForInitData } from '../lib/waitForInitData'
import { subscribeTelegramSdkReady } from '../lib/telegramSdk'
import { getMe, ApiAuthError, invalidateMeCache } from '../api/subscription'
import { defaultUserState } from '../data/types'
import { devLog, devWarn } from '../utils/devLog'
import { isWebShell } from '../config/shell'

const CACHE_KEY_PREFIX = 'tcg_premium_status'
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const PREMIUM_POLL_INTERVAL_MS = 2000
const PREMIUM_POLL_MAX_ATTEMPTS = 15
const EXPECTING_PAYMENT_FLAG = 'tcg_expecting_payment'
const EXPECTING_PAYMENT_MAX_AGE_MS = 120000 // 2 min
/** After a checkout redirect the cached "not Premium" snapshot predates the payment. */
const EXPECTING_PAYMENT_SKIP_CACHE_MS = 30 * 60 * 1000
const ACCOUNT_KEY = 'tcg_premium_account'

function expectingPaymentRecently(): boolean {
  try {
    const ts = Number(sessionStorage.getItem(EXPECTING_PAYMENT_FLAG))
    return Number.isFinite(ts) && ts > 0 && Date.now() - ts <= EXPECTING_PAYMENT_SKIP_CACHE_MS
  } catch {
    return false
  }
}

function clearExpectingPayment(): void {
  try {
    sessionStorage.removeItem(EXPECTING_PAYMENT_FLAG)
  } catch {
    // ignore
  }
}

function cacheKeyFor(accountId: string | null | undefined): string {
  return `${CACHE_KEY_PREFIX}:${accountId || 'anon'}`
}

function readAccountKey(): string {
  try {
    return sessionStorage.getItem(ACCOUNT_KEY) || 'anon'
  } catch {
    return 'anon'
  }
}

function writeAccountKey(accountId: string | null | undefined): void {
  try {
    sessionStorage.setItem(ACCOUNT_KEY, accountId || 'anon')
  } catch {
    // ignore
  }
}

function clearCache(accountId?: string | null): void {
  try {
    const key = cacheKeyFor(accountId ?? readAccountKey())
    sessionStorage.removeItem(key)
    sessionStorage.removeItem(CACHE_KEY_PREFIX)
  } catch {
    // ignore
  }
}

const STATE_KEY = 'tcg_state'

export type PremiumStatusSnapshot = {
  isPremium: boolean
  activeUntil: string | null
  isLifetime: boolean
  lastEndedAt: string | null
}

function normalizeSnapshot(raw: {
  isPremium?: boolean
  premium?: boolean
  activeUntil?: string | null
  premiumUntil?: string | null
  isLifetime?: boolean
  lastEndedAt?: string | null
}): PremiumStatusSnapshot {
  const activeUntil = raw.activeUntil ?? raw.premiumUntil ?? null
  const isLifetimeFlag = Boolean(raw.isLifetime)
  let isPremium = Boolean(raw.isPremium ?? raw.premium)
  let lastEndedAt = raw.lastEndedAt ?? null
  if (isPremium && activeUntil && !isLifetimeFlag) {
    const until = new Date(activeUntil).getTime()
    if (Number.isFinite(until) && until <= Date.now()) {
      isPremium = false
      lastEndedAt = lastEndedAt || activeUntil
    }
  }
  return {
    isPremium,
    activeUntil: isPremium ? activeUntil : null,
    isLifetime: Boolean(isPremium && isLifetimeFlag),
    lastEndedAt: isPremium ? null : lastEndedAt,
  }
}

function readCache(accountId?: string | null): PremiumStatusSnapshot | null {
  try {
    const raw = sessionStorage.getItem(cacheKeyFor(accountId ?? readAccountKey()))
    if (!raw) return null
    const parsed = JSON.parse(raw) as {
      data: PremiumStatusSnapshot
      ts: number
      account?: string
    }
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null
    const expected = accountId ?? readAccountKey()
    if (parsed.account && parsed.account !== expected) return null
    return normalizeSnapshot(parsed.data)
  } catch {
    return null
  }
}

function writeCache(data: PremiumStatusSnapshot, accountId?: string | null): void {
  try {
    const account = accountId || readAccountKey()
    writeAccountKey(account)
    sessionStorage.setItem(
      cacheKeyFor(account),
      JSON.stringify({ data, ts: Date.now(), account })
    )
  } catch {
    // ignore
  }
}

function updateTcgState(isPremium: boolean): void {
  try {
    const raw = localStorage.getItem(STATE_KEY)
    const state = raw ? JSON.parse(raw) : { ...defaultUserState }
    state.premium = isPremium
    localStorage.setItem(STATE_KEY, JSON.stringify(state))
    window.dispatchEvent(
      new CustomEvent('tcg_premium_updated', { detail: { premium: isPremium } })
    )
  } catch {
    // ignore
  }
}

export function usePremiumStatus(): {
  isPremium: boolean
  activeUntil: string | null
  isLifetime: boolean
  lastEndedAt: string | null
  loading: boolean
  authError: boolean
  authError401: boolean
  serverError503: boolean
  refetch: () => void
  refresh: () => Promise<PremiumStatusSnapshot | null>
} {
  const mountedRef = useRef(true)
  const accountRef = useRef(readAccountKey())
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [state, setState] = useState<{
    isPremium: boolean
    activeUntil: string | null
    isLifetime: boolean
    lastEndedAt: string | null
    loading: boolean
    authError: boolean
    authError401: boolean
    serverError503: boolean
  }>(() => {
    const cached = expectingPaymentRecently() ? null : readCache()
    if (cached) {
      return {
        ...cached,
        loading: false,
        authError: false,
        authError401: false,
        serverError503: false,
      }
    }
    return {
      isPremium: false,
      activeUntil: null,
      isLifetime: false,
      lastEndedAt: null,
      loading: true,
      authError: false,
      authError401: false,
      serverError503: false,
    }
  })

  const clearExpiryTimer = useCallback(() => {
    if (expiryTimerRef.current) {
      clearTimeout(expiryTimerRef.current)
      expiryTimerRef.current = null
    }
  }, [])

  const doneLoading = useCallback(
    (data: PremiumStatusSnapshot & { authError?: boolean; authError401?: boolean; serverError503?: boolean }) => {
      if (!mountedRef.current) return
      setState({
        isPremium: data.isPremium,
        activeUntil: data.activeUntil,
        isLifetime: data.isLifetime,
        lastEndedAt: data.lastEndedAt,
        loading: false,
        authError: data.authError ?? false,
        authError401: data.authError401 ?? false,
        serverError503: data.serverError503 ?? false,
      })
    },
    []
  )

  const fetchStatus = useCallback(
    async (bypassCache = false): Promise<PremiumStatusSnapshot | null> => {
      const initData = (await waitForInitData(3000)) || getInitData()

      if (!initData && !isWebShell()) {
        devLog('[TCG] Premium: no initData (open in Telegram)')
        doneLoading({
          isPremium: false,
          activeUntil: null,
          isLifetime: false,
          lastEndedAt: null,
          authError: true,
          authError401: false,
          serverError503: false,
        })
        return null
      }

      if (!bypassCache && !expectingPaymentRecently()) {
        const cached = readCache(accountRef.current)
        if (cached) {
          updateTcgState(cached.isPremium)
          doneLoading({ ...cached, authError: false, authError401: false, serverError503: false })
          return cached
        }
      }

      if (bypassCache && mountedRef.current) {
        setState((s) => ({ ...s, loading: true }))
      }
      try {
        const me = await getMe()
        const accountId = me.webAccountId ? String(me.webAccountId) : accountRef.current
        if (accountId !== accountRef.current) {
          clearCache(accountRef.current)
          accountRef.current = accountId
          writeAccountKey(accountId)
        }
        const data = normalizeSnapshot({
          isPremium: me.premium,
          activeUntil: me.premiumUntil ?? null,
          isLifetime: me.isLifetime,
          lastEndedAt: me.lastEndedAt ?? null,
        })
        writeCache(data, accountId)
        if (data.isPremium) clearExpectingPayment()
        updateTcgState(data.isPremium)
        devLog('[TCG] Premium:', data.isPremium ? 'active' : 'inactive')
        doneLoading({ ...data, authError: false, authError401: false, serverError503: false })
        return data
      } catch (e) {
        devWarn('[TCG] Premium fetch failed:', e instanceof Error ? e.message : e)
        const err = e as Error & { status?: number }
        const authError401 = e instanceof ApiAuthError || err.status === 401
        // Transient network/5xx: keep recent cache only if still within activeUntil.
        const cached = !authError401 ? readCache(accountRef.current) : null
        if (cached?.isPremium) {
          doneLoading({
            ...cached,
            authError: true,
            authError401: false,
            serverError503: err.status === 503,
          })
          return cached
        }
        // No confirmed active Premium — do not invent a successful subscription.
        doneLoading({
          isPremium: false,
          activeUntil: null,
          isLifetime: false,
          lastEndedAt: cached?.lastEndedAt ?? null,
          authError: true,
          authError401,
          serverError503: err.status === 503,
        })
        return null
      }
    },
    [doneLoading]
  )

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearExpiryTimer()
    }
  }, [clearExpiryTimer])

  useEffect(() => {
    void fetchStatus()
  }, [fetchStatus])

  useEffect(() => {
    return subscribeTelegramSdkReady(() => {
      void fetchStatus(false)
    })
  }, [fetchStatus])

  // Single timer until activeUntil — no frequent polling.
  useEffect(() => {
    clearExpiryTimer()
    if (!state.isPremium || state.isLifetime || !state.activeUntil) return
    const until = new Date(state.activeUntil).getTime()
    if (!Number.isFinite(until)) return
    const delay = until - Date.now()
    if (delay <= 0) {
      clearCache(accountRef.current)
      invalidateMeCache()
      void fetchStatus(true)
      return
    }
    // Cap setTimeout to ~24h chunks to avoid 32-bit overflow for long plans.
    const MAX_DELAY = 24 * 60 * 60 * 1000
    expiryTimerRef.current = setTimeout(() => {
      clearCache(accountRef.current)
      invalidateMeCache()
      void fetchStatus(true)
    }, Math.min(delay + 250, MAX_DELAY))
    return clearExpiryTimer
  }, [state.isPremium, state.isLifetime, state.activeUntil, fetchStatus, clearExpiryTimer])

  const premiumPollingRef = useRef(false)

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      fetchStatus(true)
      try {
        const raw = sessionStorage.getItem(EXPECTING_PAYMENT_FLAG)
        if (!raw || premiumPollingRef.current) return
        const ts = Number(raw)
        if (!Number.isFinite(ts) || Date.now() - ts > EXPECTING_PAYMENT_MAX_AGE_MS) return
        premiumPollingRef.current = true
        let attempts = 0
        const run = async () => {
          while (attempts < PREMIUM_POLL_MAX_ATTEMPTS) {
            attempts += 1
            try {
              const me = await getMe()
              if (me.premium) {
                sessionStorage.removeItem(EXPECTING_PAYMENT_FLAG)
                clearCache()
                fetchStatus(true)
                premiumPollingRef.current = false
                return
              }
            } catch {
              // ignore
            }
            if (attempts < PREMIUM_POLL_MAX_ATTEMPTS) {
              await new Promise((r) => setTimeout(r, PREMIUM_POLL_INTERVAL_MS))
            }
          }
          sessionStorage.removeItem(EXPECTING_PAYMENT_FLAG)
          premiumPollingRef.current = false
        }
        run()
      } catch {
        // ignore
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [fetchStatus])

  useEffect(() => {
    const onSync = () => {
      invalidateMeCache()
      clearCache(accountRef.current)
      // Drop UI Premium immediately so previous account cannot flash.
      if (mountedRef.current) {
        setState((s) => ({
          ...s,
          isPremium: false,
          activeUntil: null,
          isLifetime: false,
          lastEndedAt: null,
          loading: true,
        }))
      }
      fetchStatus(true)
    }
    window.addEventListener('tcg_premium_sync', onSync)
    return () => window.removeEventListener('tcg_premium_sync', onSync)
  }, [fetchStatus])

  const refresh = useCallback(async (): Promise<PremiumStatusSnapshot | null> => {
    invalidateMeCache()
    clearCache(accountRef.current)
    return fetchStatus(true)
  }, [fetchStatus])

  return {
    isPremium: state.isPremium,
    activeUntil: state.activeUntil,
    isLifetime: state.isLifetime,
    lastEndedAt: state.lastEndedAt,
    loading: state.loading,
    authError: state.authError,
    authError401: state.authError401,
    serverError503: state.serverError503,
    refetch: fetchStatus,
    refresh,
  }
}
