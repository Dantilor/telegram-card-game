import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { WebSessionMe } from '../lib/webAuth'
import { ensureWebSession, fetchWebSessionMe, logoutWebSession } from '../lib/webAuth'
import { applyIfCurrent, createSessionApplyGate } from './webSessionStale'

/** anonymous=Гость, account=email saved (not ownership-proof), verified/telegram=Авторизован */
export type WebAuthUiStatus = 'anonymous' | 'account' | 'pending' | 'verified' | 'telegram'

type WebSessionContextValue = {
  session: WebSessionMe | null
  ready: boolean
  authStatus: WebAuthUiStatus
  setSession: (session: WebSessionMe | null) => void
  refreshSession: () => Promise<WebSessionMe | null>
  logout: () => Promise<void>
  /** Short polling while email confirmation is pending (PWA ↔ Safari). */
  startEmailPendingWatch: () => void
  stopEmailPendingWatch: () => void
}

const WebSessionContext = createContext<WebSessionContextValue | null>(null)

const EMAIL_POLL_MS = 2500
const EMAIL_POLL_MAX_MS = 3 * 60_000

function deriveAuthStatus(session: WebSessionMe | null): WebAuthUiStatus {
  if (!session) return 'anonymous'
  if (session.emailVerified) return 'verified'
  if (session.telegramId) return 'telegram'
  // Saved contact email on this WEB account — not proof of mailbox ownership.
  if (session.emailPending || (session.email && !session.emailVerified)) return 'account'
  return 'anonymous'
}

function accountKey(session: WebSessionMe | null): string {
  return session?.webAccountId ? String(session.webAccountId) : ''
}

export function WebSessionProvider({
  initial = null,
  children,
}: {
  initial?: WebSessionMe | null
  children: ReactNode
}) {
  const [session, setSessionState] = useState<WebSessionMe | null>(initial)
  const [ready, setReady] = useState(Boolean(initial))
  const sessionRef = useRef(session)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollStartedAtRef = useRef(0)
  const refreshInFlight = useRef<Promise<WebSessionMe | null> | null>(null)
  const applyGateRef = useRef(createSessionApplyGate())

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  const stopEmailPendingWatch = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
    pollStartedAtRef.current = 0
  }, [])

  const applySession = useCallback((next: WebSessionMe | null) => {
    const prev = sessionRef.current
    const prevKey = accountKey(prev)
    const nextKey = accountKey(next)
    const verifiedFlipped = Boolean(next?.emailVerified) && !prev?.emailVerified
    const accountChanged = prevKey !== nextKey
    sessionRef.current = next
    setSessionState(next)
    if (accountChanged || verifiedFlipped) {
      try {
        window.dispatchEvent(new Event('tcg_premium_sync'))
        window.dispatchEvent(new Event('tcg_legal_sync'))
      } catch {
        /* ignore */
      }
    }
    if (next?.emailVerified) stopEmailPendingWatch()
  }, [stopEmailPendingWatch])

  const setSession = useCallback(
    (next: WebSessionMe | null) => {
      applyGateRef.current.bump()
      applySession(next)
    },
    [applySession]
  )

  const refreshSession = useCallback(async () => {
    if (refreshInFlight.current) return refreshInFlight.current
    const token = applyGateRef.current.generation
    const run = (async () => {
      try {
        const next = await fetchWebSessionMe()
        const applied = applyIfCurrent(applyGateRef.current, token, next, applySession)
        return applied ? next : sessionRef.current
      } catch {
        return sessionRef.current
      } finally {
        refreshInFlight.current = null
      }
    })()
    refreshInFlight.current = run
    return run
  }, [applySession])

  const startEmailPendingWatch = useCallback(() => {
    stopEmailPendingWatch()
    pollStartedAtRef.current = Date.now()
    void refreshSession()
    pollTimerRef.current = setInterval(() => {
      if (Date.now() - pollStartedAtRef.current > EMAIL_POLL_MAX_MS) {
        stopEmailPendingWatch()
        return
      }
      const current = sessionRef.current
      if (current?.emailVerified) {
        stopEmailPendingWatch()
        return
      }
      void refreshSession()
    }, EMAIL_POLL_MS)
  }, [refreshSession, stopEmailPendingWatch])

  const logout = useCallback(async () => {
    stopEmailPendingWatch()
    // Invalidate in-flight refresh before clearing so stale me cannot restore the session.
    applyGateRef.current.bump()
    refreshInFlight.current = null
    try {
      await logoutWebSession()
    } finally {
      applySession(null)
      try {
        window.dispatchEvent(new Event('tcg_premium_sync'))
      } catch {
        /* ignore */
      }
    }
  }, [applySession, stopEmailPendingWatch])

  // Bootstrap anonymous session once.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        let next = await fetchWebSessionMe()
        if (!next) next = await ensureWebSession()
        if (!cancelled) {
          applySession(next)
          setReady(true)
        }
      } catch {
        if (!cancelled) {
          applySession(null)
          setReady(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [applySession])

  // Cross-context sync when returning to the app (PWA / other tab / device).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      void refreshSession()
    }
    const onPageShow = () => {
      void refreshSession()
    }
    const onFocus = () => {
      void refreshSession()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pageshow', onPageShow)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pageshow', onPageShow)
      window.removeEventListener('focus', onFocus)
    }
  }, [refreshSession])

  useEffect(() => () => stopEmailPendingWatch(), [stopEmailPendingWatch])

  const authStatus = useMemo(() => deriveAuthStatus(session), [session])

  const value = useMemo(
    () => ({
      session,
      ready,
      authStatus,
      setSession,
      refreshSession,
      logout,
      startEmailPendingWatch,
      stopEmailPendingWatch,
    }),
    [
      session,
      ready,
      authStatus,
      setSession,
      refreshSession,
      logout,
      startEmailPendingWatch,
      stopEmailPendingWatch,
    ]
  )

  return <WebSessionContext.Provider value={value}>{children}</WebSessionContext.Provider>
}

export function useWebSession(): WebSessionContextValue {
  const ctx = useContext(WebSessionContext)
  if (!ctx) {
    return {
      session: null,
      ready: false,
      authStatus: 'anonymous',
      setSession: () => {},
      refreshSession: async () => null,
      logout: async () => {},
      startEmailPendingWatch: () => {},
      stopEmailPendingWatch: () => {},
    }
  }
  return ctx
}
