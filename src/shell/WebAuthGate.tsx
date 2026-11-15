import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  buildTelegramLoginUrl,
  devLoginWeb,
  fetchWebSessionMe,
  type WebSessionMe,
} from '../lib/webAuth'
import { WebSessionProvider } from './WebSessionContext'
import { WebAuthCrystal } from './WebAuthCrystal'
import './WebAuthGate.css'

function localDevLoginUiEnabled(): boolean {
  return Boolean(import.meta.env.DEV) && import.meta.env.VITE_WEB_DEV_LOGIN === '1'
}

type GateState =
  | { status: 'loading' }
  | { status: 'anonymous'; error: string | null }
  | { status: 'authenticated'; session: WebSessionMe }

function readLoginError(search: string): string | null {
  const params = new URLSearchParams(search)
  const raw = params.get('error')
  if (!raw) return null
  if (raw === 'access_denied' || raw === 'oidc_denied') return 'Вход отменён. Можно попробовать снова.'
  if (raw === 'oidc_token_invalid' || raw === 'unauthorized') return 'Не удалось подтвердить вход. Попробуйте ещё раз.'
  if (raw === 'oidc_not_configured') return 'Вход через Telegram ещё не настроен на сервере.'
  return 'Не удалось войти. Попробуйте ещё раз.'
}

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

function WebLoginScreen({
  error,
  returnTo,
  onRetryCheck,
  onDevLoginSuccess,
}: {
  error: string | null
  returnTo: string
  onRetryCheck: () => void
  onDevLoginSuccess: () => void
}) {
  const [starting, setStarting] = useState(false)
  const [devBusy, setDevBusy] = useState(false)
  const [devError, setDevError] = useState<string | null>(null)
  const showDevLogin = localDevLoginUiEnabled()

  const startLogin = () => {
    setStarting(true)
    const url = buildTelegramLoginUrl(returnTo)
    window.location.assign(url)
  }

  const runDevLogin = async () => {
    const secret = import.meta.env.VITE_WEB_DEV_LOGIN_SECRET as string | undefined
    if (!secret) {
      setDevError('VITE_WEB_DEV_LOGIN_SECRET не задан')
      return
    }
    setDevBusy(true)
    setDevError(null)
    try {
      await devLoginWeb({
        telegramId: 900002,
        secret,
        displayName: 'Local Premium Host',
      })
      onDevLoginSuccess()
    } catch {
      setDevError('Локальный вход не удался. Проверьте WEB_DEV_LOGIN_* на сервере.')
    } finally {
      setDevBusy(false)
    }
  }

  return (
    <div className="web-auth-gate" data-theme-surface="web-login">
      <AuthAtmosphere />
      <main className="web-auth-gate__stage">
        <WebAuthCrystal className="web-auth-gate__crystal web-auth-gate__enter web-auth-gate__enter--1" />

        <p className="web-auth-gate__eyebrow web-auth-gate__enter web-auth-gate__enter--2">GameNight Host</p>
        <h1 className="web-auth-gate__title web-auth-gate__enter web-auth-gate__enter--3">GameNight Host</h1>
        <p className="web-auth-gate__lead web-auth-gate__enter web-auth-gate__enter--4">
          Твой вечер. Твои правила. Твоя игра.
        </p>

        {(error || devError) && (
          <p className="web-auth-gate__error web-auth-gate__enter web-auth-gate__enter--5" role="alert">
            {devError || error}
          </p>
        )}

        <button
          type="button"
          className="web-auth-gate__cta web-auth-gate__enter web-auth-gate__enter--5"
          onClick={startLogin}
          disabled={starting}
        >
          <span className="web-auth-gate__cta-sheen" aria-hidden />
          <span className="web-auth-gate__cta-label">
            {starting ? 'Переход в Telegram…' : 'Войти через Telegram'}
          </span>
        </button>

        {showDevLogin && (
          <button
            type="button"
            className="web-auth-gate__ghost web-auth-gate__enter web-auth-gate__enter--6"
            data-testid="web-dev-login"
            onClick={() => void runDevLogin()}
            disabled={devBusy}
          >
            {devBusy ? 'Локальный вход…' : 'Локальный вход (dev)'}
          </button>
        )}

        <button
          type="button"
          className="web-auth-gate__ghost web-auth-gate__enter web-auth-gate__enter--6"
          onClick={onRetryCheck}
        >
          Уже вошли? Проверить сессию
        </button>
      </main>
    </div>
  )
}

export function WebAuthGate({ children }: { children: ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const queryError = useMemo(() => readLoginError(location.search), [location.search])
  const [gate, setGate] = useState<GateState>({ status: 'loading' })

  const returnTo = useMemo(() => {
    if (location.pathname === '/login') {
      const next = new URLSearchParams(location.search).get('return_to')
      if (next && next.startsWith('/') && !next.startsWith('//')) return next
      return '/'
    }
    return `${location.pathname}${location.search}`
  }, [location.pathname, location.search])

  const checkSession = async () => {
    setGate({ status: 'loading' })
    try {
      const session = await fetchWebSessionMe()
      if (session) {
        setGate({ status: 'authenticated', session })
        if (location.pathname === '/login') {
          navigate(returnTo === '/login' ? '/' : returnTo, { replace: true })
        }
        return
      }
      setGate({ status: 'anonymous', error: queryError })
    } catch {
      setGate({
        status: 'anonymous',
        error: 'Не удалось проверить сессию. Проверьте соединение и попробуйте снова.',
      })
    }
  }

  useEffect(() => {
    void checkSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-check on path/error query only
  }, [location.pathname, queryError])

  if (gate.status === 'loading') {
    return (
      <div className="web-auth-gate web-auth-gate--loading" aria-busy="true">
        <AuthAtmosphere />
        <div className="web-auth-gate__loading-stack">
          <WebAuthCrystal className="web-auth-gate__crystal web-auth-gate__crystal--pulse" />
          <p className="web-auth-gate__loading">Проверяем сессию…</p>
        </div>
      </div>
    )
  }

  if (gate.status === 'anonymous') {
    return (
      <WebLoginScreen
        error={gate.error}
        returnTo={returnTo}
        onRetryCheck={() => void checkSession()}
        onDevLoginSuccess={() => void checkSession()}
      />
    )
  }

  return <WebSessionProvider initial={gate.session}>{children}</WebSessionProvider>
}
