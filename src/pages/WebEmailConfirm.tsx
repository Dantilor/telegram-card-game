import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { isWebShell } from '../config/shell'
import { completeEmailMagicLink } from '../lib/webAuth'
import { premiumPhase } from '../lib/emailAccountSync'
import { useWebSession } from '../shell/WebSessionContext'
import { usePremium } from '../contexts/PremiumContext'
import HomeButton from '../components/HomeButton'
import './Profile.css'

/**
 * Magic-link landing.
 * GET never completes the login (mail prefetch / link scanners safe).
 * On a real user navigation we POST once automatically; if that cannot run safely,
 * a minimal fallback button remains.
 */
export default function WebEmailConfirm() {
  const [params] = useSearchParams()
  const token = useMemo(() => (params.get('token') || '').trim(), [params])
  const navigate = useNavigate()
  const webSession = useWebSession()
  const { refreshPremium } = usePremium()
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [showFallback, setShowFallback] = useState(false)
  const startedRef = useRef(false)

  const confirm = useCallback(async () => {
    if (!token) {
      setStatus('Ссылка неполная. Запросите новое письмо на странице входа.')
      setShowFallback(true)
      return
    }
    setBusy(true)
    setStatus(null)
    try {
      await completeEmailMagicLink(token)
      setStatus('Проверяем подписку…')
      await webSession.refreshSession()
      const syncPhase = await premiumPhase(refreshPremium)
      setDone(true)
      const toast = syncPhase === 'restored' ? 'Premium восстановлен!' : 'Аккаунт готов к игре'
      setStatus(toast)
      const next =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('next')
          : null
      const target =
        next && next.startsWith('/') && !next.startsWith('//') ? next : '/profile'
      navigate(target, { replace: true, state: { emailAuthToast: toast, emailSyncPhase: syncPhase } })
    } catch {
      setStatus('Ссылка недействительна или уже использована. Запросите новую на странице входа.')
      setShowFallback(true)
    } finally {
      setBusy(false)
    }
  }, [token, webSession, refreshPremium, navigate])

  useEffect(() => {
    if (!isWebShell() || !token || startedRef.current) return
    let cancelled = false
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null

    const tryAuto = () => {
      if (cancelled || startedRef.current) return
      // Prefer a focused, visible document — typical of a real user tap, not a silent prefetch.
      if (document.visibilityState === 'hidden') {
        setShowFallback(true)
        return
      }
      startedRef.current = true
      void confirm()
    }

    // Brief delay so link scanners that only hit GET / instant fetch rarely complete a POST.
    const startTimer = window.setTimeout(() => {
      if (cancelled) return
      if (document.visibilityState === 'visible') {
        tryAuto()
      } else {
        setShowFallback(true)
      }
    }, 350)

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (!startedRef.current) tryAuto()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pageshow', onVisible)
    window.addEventListener('focus', onVisible)

    fallbackTimer = setTimeout(() => {
      if (!cancelled && !done && !busy) setShowFallback(true)
    }, 2500)

    return () => {
      cancelled = true
      window.clearTimeout(startTimer)
      if (fallbackTimer) clearTimeout(fallbackTimer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pageshow', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [token, confirm, done, busy])

  if (!isWebShell()) {
    return (
      <div className="profile-page">
        <p>Подтверждение почты доступно только на сайте.</p>
        <HomeButton />
      </div>
    )
  }

  return (
    <div className="profile-page">
      <div className="profile-top">
        <HomeButton />
      </div>
      <section className="profile-pass" aria-live="polite">
        <p className="profile-pass__eyebrow">GameNight Host</p>
        <p className="profile-pass__title">{busy || (!showFallback && !status) ? 'Входим…' : 'Вход по ссылке'}</p>
        <p className="profile-pass__desc">
          {busy || (!showFallback && !status)
            ? 'Секунду — завершаем вход без лишних шагов.'
            : 'Если вход не начался автоматически, продолжите одной кнопкой. Письмо само по себе ничего не активирует.'}
        </p>
        {(showFallback || status) && !done ? (
          <button
            type="button"
            className="profile-pass__cta"
            disabled={busy || !token}
            onClick={() => {
              startedRef.current = true
              void confirm()
            }}
          >
            {busy ? 'Вход…' : 'Продолжить вход'}
          </button>
        ) : null}
        {status && <span className="profile-pass__toast">{status}</span>}
        <p className="profile-pass__desc">
          <Link to="/login">Запросить новую ссылку</Link>
        </p>
      </section>
    </div>
  )
}
