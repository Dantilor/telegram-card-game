import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import {
  ensureWebSession,
  fetchWebSessionMe,
  type WebSessionMe,
} from '../lib/webAuth'
import { WebSessionProvider } from './WebSessionContext'
import { WebAuthCrystal } from './WebAuthCrystal'
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
 * Children (Home/games) render immediately after ensure/session check.
 */
export function WebAuthGate({ children }: { children: ReactNode }) {
  const location = useLocation()
  const [gate, setGate] = useState<GateState>({ status: 'loading' })

  const bootstrap = useMemo(
    () => async () => {
      setGate({ status: 'loading' })
      try {
        let session = await fetchWebSessionMe()
        if (!session) {
          session = await ensureWebSession()
        }
        setGate({ status: 'ready', session })
        // PremiumProvider mounts outside the gate and may have fetched /api/me before cookie —
        // re-sync after anonymous ensure so first paint does not stick on 401/free.
        if (session) {
          window.dispatchEvent(new Event('tcg_premium_sync'))
        }
      } catch {
        // Soft-fail: still allow browsing free UI; APIs enforce auth where needed.
        setGate({
          status: 'ready',
          session: null,
        })
      }
    },
    []
  )

  useEffect(() => {
    void bootstrap()
  }, [bootstrap, location.pathname])

  if (gate.status === 'loading') {
    return (
      <div className="web-auth-gate web-auth-gate--loading" aria-busy="true">
        <AuthAtmosphere />
        <div className="web-auth-gate__loading-stack">
          <WebAuthCrystal className="web-auth-gate__crystal web-auth-gate__crystal--pulse" />
          <p className="web-auth-gate__loading">Загружаем GameNight Host…</p>
        </div>
      </div>
    )
  }

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

  if (gate.session) {
    return <WebSessionProvider initial={gate.session}>{children}</WebSessionProvider>
  }

  return <>{children}</>
}
