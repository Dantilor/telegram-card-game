import { useState, useEffect, useCallback, useRef } from 'react'
import { getInitData } from '../utils/telegram'
import { getPremiumStatus } from '../api/subscription'
import { defaultUserState } from '../data/types'

const CACHE_KEY = 'tcg_premium_status'
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const STATE_KEY = 'tcg_state'
const isDev = import.meta.env.DEV

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
  refetch: () => void
} {
  const baseURL = import.meta.env.VITE_API_BASE ?? ''
  const mountedRef = useRef(true)

  const [state, setState] = useState<{
    isPremium: boolean
    activeUntil: string | null
    loading: boolean
  }>(() => {
    const cached = readCache()
    if (cached) {
      return {
        isPremium: cached.isPremium,
        activeUntil: cached.activeUntil,
        loading: false,
      }
    }
    return {
      isPremium: false,
      activeUntil: null,
      loading: true,
    }
  })

  const doneLoading = useCallback((data: { isPremium: boolean; activeUntil: string | null }) => {
    if (mountedRef.current) {
      setState({ ...data, loading: false })
    }
  }, [])

  const fetchStatus = useCallback(async () => {
    const init = getInitData()
    const initData = init.initDataRaw

    if (!initData) {
      if (isDev) console.log('[TCG] Premium: no initData (open in Telegram)')
      doneLoading({ isPremium: false, activeUntil: null })
      return
    }
    if (!baseURL) {
      if (isDev) console.log('[TCG] Premium: VITE_API_BASE not set, using isPremium=false')
      doneLoading({ isPremium: false, activeUntil: null })
      return
    }

    const cached = readCache()
    if (cached) {
      updateTcgState(cached.isPremium)
      doneLoading({ isPremium: cached.isPremium, activeUntil: cached.activeUntil })
      return
    }

    setState((s) => ({ ...s, loading: true }))
    try {
      const res = await getPremiumStatus()
      const data = {
        isPremium: res.isPremium,
        activeUntil: res.activeUntil ?? null,
      }
      writeCache(data)
      updateTcgState(data.isPremium)
      if (isDev) console.log('[TCG] Premium:', data.isPremium ? 'active' : 'inactive')
      doneLoading(data)
    } catch (e) {
      if (isDev) console.warn('[TCG] Premium fetch failed:', e instanceof Error ? e.message : e)
      doneLoading({ isPremium: false, activeUntil: null })
    }
  }, [baseURL, doneLoading])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchStatus()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [fetchStatus])

  useEffect(() => {
    const onSync = () => fetchStatus()
    window.addEventListener('tcg_premium_sync', onSync)
    return () => window.removeEventListener('tcg_premium_sync', onSync)
  }, [fetchStatus])

  return {
    isPremium: state.isPremium,
    activeUntil: state.activeUntil,
    loading: state.loading,
    refetch: fetchStatus,
  }
}
