import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import crownIcon from '../assets/icons/gnh/host-crown.svg'
import { buildTelegramLoginUrl, fetchWebSessionMe, type WebSessionMe } from '../lib/webAuth'
import { WebSessionProvider } from './WebSessionContext'
import './WebAuthGate.css'

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

function WebLoginScreen({
  error,
  returnTo,
  onRetryCheck,
}: {
  error: string | null
  returnTo: string
  onRetryCheck: () => void
}) {
  const [starting, setStarting] = useState(false)

  const startLogin = () => {
    setStarting(true)
    const url = buildTelegramLoginUrl(returnTo)
    window.location.assign(url)
  }

  return (
    <div className="web-auth-gate" data-theme-surface="web-login">
      <div className="web-auth-gate__bg" aria-hidden />
      <main className="web-auth-gate__card">
        <div className="web-auth-gate__brand">
          <img src={crownIcon} alt="" className="web-auth-gate__logo" width={56} height={56} />
          <p className="web-auth-gate__eyebrow">GameNight Host</p>
          <h1 className="web-auth-gate__title">GameNight Host</h1>
          <p className="web-auth-gate__lead">Ваши игры и Premium всегда с вами</p>
        </div>

        {error && (
          <p className="web-auth-gate__error" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          className="web-auth-gate__cta"
          onClick={startLogin}
          disabled={starting}
        >
          {starting ? 'Переход в Telegram…' : 'Войти через Telegram'}
        </button>

        <button type="button" className="web-auth-gate__ghost" onClick={onRetryCheck}>
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
        <div className="web-auth-gate__bg" aria-hidden />
        <p className="web-auth-gate__loading">Загрузка…</p>
      </div>
    )
  }

  if (gate.status === 'anonymous') {
    return (
      <WebLoginScreen
        error={gate.error}
        returnTo={returnTo}
        onRetryCheck={() => void checkSession()}
      />
    )
  }

  return <WebSessionProvider initial={gate.session}>{children}</WebSessionProvider>
}
