import { createContext, useContext, type ReactNode } from 'react'
import { usePremiumStatus } from '../hooks/usePremiumStatus'

type PremiumContextValue = {
  isPremium: boolean
  activeUntil: string | null
  loading: boolean
  authError: boolean
  refetch: () => void
}

const PremiumContext = createContext<PremiumContextValue>({
  isPremium: false,
  activeUntil: null,
  loading: false,
  authError: false,
  refetch: () => {},
})

export function PremiumProvider({ children }: { children: ReactNode }) {
  const value = usePremiumStatus()
  return (
    <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>
  )
}

export function usePremium(): PremiumContextValue {
  return useContext(PremiumContext)
}
