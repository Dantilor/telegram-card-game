import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { WebSessionMe } from '../lib/webAuth'
import { fetchWebSessionMe, logoutWebSession } from '../lib/webAuth'

type WebSessionContextValue = {
  session: WebSessionMe | null
  setSession: (session: WebSessionMe | null) => void
  refreshSession: () => Promise<WebSessionMe | null>
  logout: () => Promise<void>
}

const WebSessionContext = createContext<WebSessionContextValue | null>(null)

export function WebSessionProvider({
  initial,
  children,
}: {
  initial: WebSessionMe | null
  children: ReactNode
}) {
  const [session, setSession] = useState<WebSessionMe | null>(initial)

  const refreshSession = useCallback(async () => {
    const next = await fetchWebSessionMe()
    setSession(next)
    return next
  }, [])

  const logout = useCallback(async () => {
    try {
      await logoutWebSession()
    } finally {
      setSession(null)
    }
  }, [])

  const value = useMemo(
    () => ({ session, setSession, refreshSession, logout }),
    [session, refreshSession, logout]
  )

  return <WebSessionContext.Provider value={value}>{children}</WebSessionContext.Provider>
}

export function useWebSession(): WebSessionContextValue {
  const ctx = useContext(WebSessionContext)
  if (!ctx) {
    return {
      session: null,
      setSession: () => {},
      refreshSession: async () => null,
      logout: async () => {},
    }
  }
  return ctx
}
