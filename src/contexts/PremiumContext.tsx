import { createContext, useContext, type ReactNode } from 'react'
import { usePremiumStatus } from '../hooks/usePremiumStatus'

type PremiumContextValue = {
  isPremium: boolean
  activeUntil: string | null
  loading: boolean
  authError: boolean
  authError401: boolean
  serverError503: boolean
  refetch: () => void
  refresh: () => Promise<{ isPremium: boolean; activeUntil: string | null } | null>
  refreshPremium: () => Promise<{ isPremium: boolean; activeUntil: string | null } | null>
}

const PremiumContext = createContext<PremiumContextValue>({
  isPremium: false,
  activeUntil: null,
  loading: false,
  authError: false,
  authError401: false,
  serverError503: false,
  refetch: () => {},
  refresh: async () => null,
  refreshPremium: async () => null,
})

export function PremiumProvider({ children }: { children: ReactNode }) {
  const hook = usePremiumStatus()
  const value = {
    ...hook,
    refreshPremium: hook.refresh,
  }
  return (
    <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>
  )
}

export function usePremium(): PremiumContextValue {
  return useContext(PremiumContext)
}
