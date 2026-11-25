import { useCallback, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { isWebShell } from '../config/shell'
import { completeEmailCode, ensureWebSession, startEmailCode } from '../lib/webAuth'
import { premiumPhase } from '../lib/emailAccountSync'
import { useWebSession } from '../shell/WebSessionContext'
import { usePremium } from '../contexts/PremiumContext'
import HomeButton from '../components/HomeButton'
import './Profile.css'

const AUTH_ERROR_HINTS: Record<string, string> = {
  owner_only: 'Этот вход через Telegram сейчас недоступен. Войдите по email.',
  auth_error: 'Не удалось войти через Telegram. Попробуйте email.',
  csrf_failed: 'Сессия устарела. Обновите страницу.',
}

/**
 * Email login and Premium recovery directly in Chrome/Safari/PWA.
 * The mailbox delivers a six-digit code; nobody needs to open a link
 * in a different browser.
 */
export default function WebPurchaseRecover() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const webSession = useWebSession()
  const { refreshPremium } = usePremium()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(() => {
    const err = (params.get('error') || '').trim()
    return err ? AUTH_ERROR_HINTS[err] || 'Не удалось завершить вход. Попробуйте ещё раз.' : null
  })

  const start = useCallback(async () => {
    if (!email.trim() || busy) return
    setBusy(true)
    setStatus(null)
    try {
      // /login can be opened in a fresh browser without a WEB session.
      // Create or reuse the local guest session before requesting a code.
      const current = await ensureWebSession()
      if (!current?.webAccountId) throw new Error('web_session_missing')
      const sent = await startEmailCode(email.trim())
      setChallengeId(sent.challengeId)
      setCode('')
      setStatus('Код отправлен на почту. Введите 6 цифр здесь — Safari или другое приложение открывать не нужно.')
    } catch (e) {
      const err = e as Error & { status?: number; code?: string }
      setStatus(err.status === 429
        ? 'Слишком много запросов. Подождите минуту и попробуйте снова.'
        : err.code === 'email_already_verified'
          ? 'Чтобы войти под другой почтой, сначала выйдите из текущего аккаунта.'
          : 'Не удалось отправить код. Проверьте соединение и попробуйте снова.')
    } finally {
      setBusy(false)
    }
  }, [busy, email])

  const finish = useCallback(async () => {
    if (!challengeId || !/^[0-9]{6}$/.test(code) || busy) return
    setBusy(true)
    setStatus(null)
    try {
      await completeEmailCode(challengeId, code)
      await webSession.refreshSession()
      const result = await premiumPhase(refreshPremium)
      const toast = result === 'restored' ? 'Premium восстановлен!' : 'Аккаунт готов к игре'
      navigate('/profile', { replace: true, state: { emailAuthToast: toast, emailSyncPhase: result } })
    } catch (e) {
      const err = e as Error & { status?: number; code?: string }
      setStatus(err.status === 429
        ? 'Слишком много попыток. Запросите новый код чуть позже.'
        : err.code === 'invalid_code'
          ? 'Неверный или истёкший код. Проверьте цифры или запросите новый.'
          : 'Не удалось завершить вход. Попробуйте ещё раз.')
    } finally {
      setBusy(false)
    }
  }, [busy, challengeId, code, navigate, refreshPremium, webSession])

  const onSend = (e: FormEvent) => { e.preventDefault(); void start() }
  const onVerify = (e: FormEvent) => { e.preventDefault(); void finish() }

  if (!isWebShell()) {
    return <div className="profile-page"><p>Вход по email доступен только на сайте GameNight Host.</p><HomeButton /></div>
  }

  return (
    <div className="profile-page">
      <div className="profile-top"><HomeButton /></div>
      <section className="profile-pass">
        <p className="profile-pass__eyebrow">Вход</p>
        <p className="profile-pass__title">Войти по email</p>
        <p className="profile-pass__desc">
          Введите адрес, получите шестизначный код и подтвердите его прямо здесь.
          Все действующие покупки Premium на эту почту появятся автоматически.
        </p>
        <form className="profile-pass__email-form" onSubmit={onSend}>
          <label className="profile-pass__email-label">
            Ваш email
            <input
              type="email"
              className="profile-pass__email-input"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setChallengeId(null); setCode('') }}
              placeholder="name@example.com"
              autoComplete="email"
              inputMode="email"
              disabled={busy}
              required
            />
          </label>
          {!challengeId && (
            <button type="submit" className="profile-pass__cta" disabled={busy || !email.trim()}>
              {busy ? 'Отправка…' : 'Получить код'}
            </button>
          )}
        </form>
        {challengeId && (
          <form className="profile-pass__email-form" onSubmit={onVerify}>
            <label className="profile-pass__email-label">
              Код из письма
              <input
                type="text"
                className="profile-pass__email-input"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                placeholder="000000"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                pattern="[0-9]{6}"
                required
                data-testid="login-email-code"
              />
            </label>
            <button className="profile-pass__cta" type="submit"
              disabled={busy || code.length !== 6}>
              {busy ? 'Проверка…' : 'Войти и открыть Premium'}
            </button>
            <button className="profile-pass__restore" type="button" onClick={() => void start()} disabled={busy}>
              Отправить новый код
            </button>
          </form>
        )}
        {status && <p className="profile-pass__desc" role="status">{status}</p>}
        <p className="profile-pass__desc">
          <Link to="/">На главную</Link> · <Link to="/profile">Профиль</Link>
        </p>
      </section>
    </div>
  )
}
