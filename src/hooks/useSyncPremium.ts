import { useEffect } from 'react'
import { getInitData } from '../utils/telegram'
import { getMe } from '../api/subscription'
import { defaultUserState } from '../data/types'

const STORAGE_KEY = 'tcg_state'

function syncPremiumFromBackend(): void {
  const init = getInitData()
  if (!init.initDataRaw) return
  const base = import.meta.env.VITE_API_BASE ?? ''
  if (typeof window !== 'undefined' && !base && /github\.io/i.test(window.location.hostname)) return

  getMe()
    .then((data) => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        const state = raw ? (JSON.parse(raw) as typeof defaultUserState) : { ...defaultUserState }
        state.premium = data.premium
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
        window.dispatchEvent(
          new CustomEvent('tcg_premium_updated', { detail: { premium: data.premium } })
        )
      } catch {
        // ignore
      }
    })
    .catch(() => {
      // ignore (offline / server down)
    })
}

export function useSyncPremium(): void {
  useEffect(() => {
    if (!getInitData().initDataRaw) return

    syncPremiumFromBackend()

    const onVisible = () => {
      if (document.visibilityState === 'visible' && getInitData().initDataRaw) syncPremiumFromBackend()
    }
    document.addEventListener('visibilitychange', onVisible)

    const onSyncRequest = () => syncPremiumFromBackend()
    window.addEventListener('tcg_premium_sync', onSyncRequest)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('tcg_premium_sync', onSyncRequest)
    }
  }, [])
}
