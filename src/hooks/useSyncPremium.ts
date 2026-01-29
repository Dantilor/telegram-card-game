import { useEffect } from 'react'
import { getTg } from '../utils/telegram'
import { getMe } from '../api/subscription'
import { defaultUserState } from '../data/types'

const STORAGE_KEY = 'tcg_state'

function syncPremiumFromBackend(): void {
  const tg = getTg()
  if (!tg?.initData) return

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
    if (!getTg()?.initData) return

    syncPremiumFromBackend()

    const onVisible = () => {
      if (document.visibilityState === 'visible') syncPremiumFromBackend()
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
