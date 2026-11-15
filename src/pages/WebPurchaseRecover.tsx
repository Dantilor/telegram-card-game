import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { isWebShell } from '../config/shell'
import { resolveApiBase } from '../lib/apiBase'
import { readCsrfToken } from '../lib/csrf'
import HomeButton from '../components/HomeButton'
import './Profile.css'

function apiBase(): string {
  if (isWebShell()) {
    const url = (import.meta.env.VITE_API_URL as string | undefined)?.trim()
    const base = (import.meta.env.VITE_API_BASE as string | undefined)?.trim()
    if (!url && !base) return ''
  }
  return resolveApiBase(import.meta.env)
}

/**
 * Restore WEB Premium after cookie loss via verified email OTP.
 * No password / Telegram login required.
 */
export default function WebPurchaseRecover() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const start = useCallback(async () => {
    if (!email.trim()) return
    setBusy(true)
    setStatus(null)
    try {
      const res = await fetch(`${apiBase()}/api/web/email/recover/start`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      if (!res.ok) throw new Error('start_failed')
      const body = (await res.json()) as { code?: string }
      setStep('code')
      setStatus(
        body.code
          ? `Код отправлен (тестовый: ${body.code})`
          : 'Если email привязан к покупке, код уже отправлен. Действует 10 минут.'
      )
      if (body.code) setCode(body.code)
    } catch {
      setStatus('Не удалось отправить код. Попробуйте позже.')
    } finally {
      setBusy(false)
    }
  }, [email])

  const complete = useCallback(async () => {
    if (!email.trim() || !code.trim()) return
    setBusy(true)
    setStatus(null)
    try {
      const res = await fetch(`${apiBase()}/api/web/email/recover/complete`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(readCsrfToken() ? { 'X-CSRF-Token': readCsrfToken()! } : {}),
        },
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      })
      if (!res.ok) throw new Error('complete_failed')
      setDone(true)
      setStatus('Покупка восстановлена на этом устройстве.')
    } catch {
      setStatus('Неверный или просроченный код.')
    } finally {
      setBusy(false)
    }
  }, [email, code])

  if (!isWebShell()) {
    return (
      <div className="profile-page">
        <p>Восстановление WEB-покупок доступно только на сайте.</p>
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
        <p className="profile-pass__eyebrow">Восстановление покупки</p>
        <p className="profile-pass__title">Email после потери cookie</p>
        <p className="profile-pass__desc">
          Если вы ранее подтвердили email для защиты Premium, введите его здесь. Без
          подтверждённого email перенос на новое устройство невозможен.
        </p>
        <label className="profile-pass__email-label">
          Email
          <input
            type="email"
            className="profile-pass__email-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            autoComplete="email"
            disabled={busy || done}
          />
        </label>
        {step === 'code' && (
          <label className="profile-pass__email-label">
            Код из письма
            <input
              type="text"
              inputMode="numeric"
              className="profile-pass__email-input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="8 цифр"
              maxLength={8}
              disabled={busy || done}
            />
          </label>
        )}
        <button
          type="button"
          className="profile-pass__cta"
          disabled={busy || done || !email.trim() || (step === 'code' && !code.trim())}
          onClick={() => void (step === 'email' ? start() : complete())}
        >
          {busy ? 'Загрузка…' : step === 'email' ? 'Отправить код' : 'Восстановить покупку'}
        </button>
        {status && <span className="profile-pass__toast">{status}</span>}
        {done && (
          <p className="profile-pass__desc">
            <Link to="/profile">Открыть профиль</Link> · <Link to="/premium">Premium</Link>
          </p>
        )}
      </section>
    </div>
  )
}
