import { useState, useEffect, useCallback, useRef } from 'react'
import { getInitData } from '../lib/telegram'
import { getMe, ApiAuthError } from '../api/subscription'
import { defaultUserState } from '../data/types'
import { devLog, devWarn } from '../utils/devLog'

const CACHE_KEY = 'tcg_premium_status'
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const PREMIUM_POLL_INTERVAL_MS = 2000
const PREMIUM_POLL_MAX_ATTEMPTS = 15
const EXPECTING_PAYMENT_FLAG = 'tcg_expecting_payment'
const EXPECTING_PAYMENT_MAX_AGE_MS = 120000 // 2 min

function clearCache(): void {
  try {
    sessionStorage.removeItem(CACHE_KEY)
  } catch {
    // ignore
  }
}
const STATE_KEY = 'tcg_state'

type PremiumStatus = {
  isPremium: boolean
  activeUntil: string | null
}

function readCache(): PremiumStatus | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw) as { data: PremiumStatus; ts: number }
    if (Date.now() - ts > CACHE_TTL_MS) return null
    return data
  } catch {
    return null
  }
}

function writeCache(data: PremiumStatus): void {
  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ data, ts: Date.now() })
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
  loading: boolean
  authError: boolean
  authError401: boolean
  serverError503: boolean
  refetch: () => void
  refresh: () => Promise<{ isPremium: boolean; activeUntil: string | null } | null>
} {
  const mountedRef = useRef(true)

  const [state, setState] = useState<{
    isPremium: boolean
    activeUntil: string | null
    loading: boolean
    authError: boolean
    authError401: boolean
    serverError503: boolean
  }>(() => {
    const cached = readCache()
    if (cached) {
      return {
        isPremium: cached.isPremium,
        activeUntil: cached.activeUntil,
        loading: false,
        authError: false,
        authError401: false,
        serverError503: false,
      }
    }
    return {
      isPremium: false,
      activeUntil: null,
      loading: true,
      authError: false,
      authError401: false,
      serverError503: false,
    }
  })

  const doneLoading = useCallback((data: { isPremium: boolean; activeUntil: string | null; authError?: boolean; authError401?: boolean; serverError503?: boolean }) => {
    if (mountedRef.current) {
      setState({
        ...data,
        loading: false,
        authError: data.authError ?? false,
        authError401: data.authError401 ?? false,
        serverError503: data.serverError503 ?? false,
      })
    }
  }, [])

  const fetchStatus = useCallback(async (bypassCache = false): Promise<{ isPremium: boolean; activeUntil: string | null } | null> => {
    const initData = getInitData()

    if (!initData) {
      devLog('[TCG] Premium: no initData (open in Telegram)')
      doneLoading({ isPremium: false, activeUntil: null, authError: true, authError401: false, serverError503: false })
      return null
    }

    if (!bypassCache) {
      const cached = readCache()
      if (cached) {
        updateTcgState(cached.isPremium)
        doneLoading({ isPremium: cached.isPremium, activeUntil: cached.activeUntil, authError: false, authError401: false, serverError503: false })
        return cached
      }
    }

    setState((s) => ({ ...s, loading: true }))
    try {
      const me = await getMe()
      const data = {
        isPremium: me.premium,
        activeUntil: me.premiumUntil ?? null,
      }
      writeCache(data)
      updateTcgState(data.isPremium)
      devLog('[TCG] Premium:', data.isPremium ? 'active' : 'inactive')
      doneLoading({ ...data, authError: false, authError401: false, serverError503: false })
      return data
    } catch (e) {
      devWarn('[TCG] Premium fetch failed:', e instanceof Error ? e.message : e)
      const err = e as Error & { status?: number }
      doneLoading({
        isPremium: false,
        activeUntil: null,
        authError: true,
        authError401: e instanceof ApiAuthError,
        serverError503: err.status === 503,
      })
      return null
    }
  }, [doneLoading])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const premiumPollingRef = useRef(false)

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      // One-time refresh when tab becomes visible
      fetchStatus()
      // If user likely returned from YooKassa, poll until premium is active
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
      clearCache()
      fetchStatus(true)
    }
    window.addEventListener('tcg_premium_sync', onSync)
    return () => window.removeEventListener('tcg_premium_sync', onSync)
  }, [fetchStatus])

  const refresh = useCallback(async (): Promise<{ isPremium: boolean; activeUntil: string | null } | null> => {
    clearCache()
    return fetchStatus(true)
  }, [fetchStatus])

  return {
    isPremium: state.isPremium,
    activeUntil: state.activeUntil,
    loading: state.loading,
    authError: state.authError,
    authError401: state.authError401,
    serverError503: state.serverError503,
    refetch: fetchStatus,
    refresh,
  }
}
