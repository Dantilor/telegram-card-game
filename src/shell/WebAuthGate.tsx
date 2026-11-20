import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ensureWebSession,
  fetchWebSessionMe,
  type WebSessionMe,
} from '../lib/webAuth'
import { WebSessionProvider } from './WebSessionContext'
import './WebAuthGate.css'

type GateState =
  | { status: 'loading' }
  | { status: 'ready'; session: WebSessionMe | null }
  | { status: 'error'; message: string }

function AuthAtmosphere() {
  return (
    <>
      <div className="web-auth-gate__aurora" aria-hidden />
      <div className="web-auth-gate__veil" aria-hidden />
      <div className="web-auth-gate__particles" aria-hidden>
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
    </>
  )
}

/**
 * WEB bootstrap: anonymous account cookie, no mandatory login.
 * Paint children immediately — session resolves in the background (no full-screen gate flash).
 */
export function WebAuthGate({ children }: { children: ReactNode }) {
  const [gate, setGate] = useState<GateState>({ status: 'ready', session: null })

  const bootstrap = useMemo(
    () => async () => {
      try {
        let session = await fetchWebSessionMe()
        if (!session) {
          session = await ensureWebSession()
        }
        setGate({ status: 'ready', session })
        // PremiumProvider may have fetched /api/me before cookie — re-sync after ensure.
        if (session) {
          window.dispatchEvent(new Event('tcg_premium_sync'))
          window.dispatchEvent(new Event('tcg_legal_sync'))
        }
      } catch {
        setGate({ status: 'ready', session: null })
      }
    },
    []
  )

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  if (gate.status === 'error') {
    return (
      <div className="web-auth-gate" data-theme-surface="web-login">
        <AuthAtmosphere />
        <main className="web-auth-gate__stage">
          <p className="web-auth-gate__error" role="alert">
            {gate.message}
          </p>
          <button type="button" className="web-auth-gate__cta" onClick={() => void bootstrap()}>
            <span className="web-auth-gate__cta-label">Повторить</span>
          </button>
        </main>
      </div>
    )
  }

  if (gate.status === 'ready' && gate.session) {
    return <WebSessionProvider initial={gate.session}>{children}</WebSessionProvider>
  }

  return <>{children}</>
}
