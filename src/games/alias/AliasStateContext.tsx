import { createContext, useContext, type ReactNode } from 'react'
import type { AliasState } from './state'
import type { AliasAction } from './reducer'
import { useAliasState } from './useAliasState'

type AliasStateContextValue = {
  state: AliasState
  setState: (v: AliasState | ((prev: AliasState) => AliasState)) => void
  dispatch: (action: AliasAction) => void
}

const AliasStateContext = createContext<AliasStateContextValue | null>(null)

export function AliasProvider({ children }: { children: ReactNode }) {
  const [state, setState, dispatch] = useAliasState()
  return (
    <AliasStateContext.Provider value={{ state, setState, dispatch }}>
      {children}
    </AliasStateContext.Provider>
  )
}

export function useAliasStateContext(): AliasStateContextValue {
  const value = useContext(AliasStateContext)
  if (value == null) {
    throw new Error('useAliasStateContext must be used within AliasProvider')
  }
  return value
}
