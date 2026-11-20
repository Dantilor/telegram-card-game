import { useCallback, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { isWebShell } from '../config/shell'
import { startEmailRecover } from '../lib/webAuth'
import HomeButton from '../components/HomeButton'
import './Profile.css'

const AUTH_ERROR_HINTS: Record<string, string> = {
  owner_only: 'Этот вход через Telegram сейчас недоступен. Войдите по email.',
  auth_error: 'Не удалось войти через Telegram. Попробуйте email.',
  csrf_failed: 'Сессия устарела. Запросите новую ссылку.',
}

/**
 * WEB email login / Premium restore via magic link.
 * Same account system as anonymous sessions + bind — no second identity store.
 */
export default function WebPurchaseRecover() {
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [status, setStatus] = useState<string | null>(() => {
    const err = (params.get('error') || '').trim()
    return err ? AUTH_ERROR_HINTS[err] || 'Не удалось завершить вход. Попробуйте email.' : null
  })

  const canSubmit = useMemo(() => Boolean(email.trim()) && !busy, [email, busy])

  const start = useCallback(async () => {
    if (!email.trim()) return
    setBusy(true)
    setStatus(null)
    try {
      await startEmailRecover(email.trim())
      setSent(true)
      setStatus(
        'Если этот адрес связан с аккаунтом, мы отправили одноразовую ссылку для входа. Откройте её на этом устройстве.'
      )
    } catch (e) {
      const statusCode = (e as Error & { status?: number }).status
      if (statusCode === 429) {
        setStatus('Слишком много попыток. Подождите минуту и попробуйте снова.')
      } else {
        setStatus('Не удалось отправить ссылку. Попробуйте позже.')
      }
    } finally {
      setBusy(false)
    }
  }, [email])

  const onSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault()
      void start()
    },
    [start]
  )

  if (!isWebShell()) {
    return (
      <div className="profile-page">
        <p>Вход по email доступен только на сайте GameNight Host.</p>
        <HomeButton />
      </div>
    )
  }

  return (
    <div className="profile-page">
      <div className="profile-top">
        <HomeButton />
      </div>
      <section className="profile-pass">
        <p className="profile-pass__eyebrow">Вход</p>
        <p className="profile-pass__title">Войти по email</p>
        <p className="profile-pass__desc">
          Введите почту аккаунта и запросите ссылку сами. После перехода по письму вход завершится
          без лишних окон. Premium вернётся на этом устройстве. Telegram не обязателен.
        </p>
        {!sent && (
          <form className="profile-pass__email-form" onSubmit={onSubmit}>
            <label className="profile-pass__email-label">
              Ваш email
              <input
                type="email"
                className="profile-pass__email-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                autoComplete="email"
                inputMode="email"
                disabled={busy}
                required
              />
            </label>
            <button type="submit" className="profile-pass__cta" disabled={!canSubmit}>
              {busy ? 'Отправка…' : 'Получить ссылку'}
            </button>
          </form>
        )}
        {status && <span className="profile-pass__toast">{status}</span>}
        {sent && (
          <p className="profile-pass__desc">
            <Link to="/">На главную</Link> · <Link to="/profile">Профиль</Link>
          </p>
        )}
        {!sent && (
          <p className="profile-pass__desc">
            Ещё нет почты на этом устройстве? Откройте{' '}
            <Link to="/profile">Профиль</Link> и нажмите «Привязать почту» — это и есть регистрация.
            Telegram можно связать позже, по желанию.
          </p>
        )}
      </section>
    </div>
  )
}
