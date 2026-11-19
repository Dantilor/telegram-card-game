import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { isWebShell } from '../config/shell'
import { startEmailRecover } from '../lib/webAuth'
import HomeButton from '../components/HomeButton'
import './Profile.css'

/**
 * Restore WEB Premium after cookie loss via magic-link email.
 * No password / OTP codes / Telegram login required.
 */
export default function WebPurchaseRecover() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const start = useCallback(async () => {
    if (!email.trim()) return
    setBusy(true)
    setStatus(null)
    try {
      await startEmailRecover(email.trim())
      setSent(true)
      setStatus(
        'Проверьте почту. Мы отправили ссылку для входа, если этот адрес связан с вашим аккаунтом.'
      )
    } catch {
      setStatus('Не удалось отправить ссылку. Попробуйте позже.')
    } finally {
      setBusy(false)
    }
  }, [email])

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
        <p className="profile-pass__eyebrow">Восстановление</p>
        <p className="profile-pass__title">С возвращением!</p>
        <p className="profile-pass__desc">
          Введите почту, которую указали при покупке. Мы отправим ссылку, чтобы вернуть ваши игры
          и Premium.
        </p>
        {!sent && (
          <>
            <label className="profile-pass__email-label">
              Ваш email
              <input
                type="email"
                className="profile-pass__email-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                autoComplete="email"
                disabled={busy}
              />
            </label>
            <button
              type="button"
              className="profile-pass__cta"
              disabled={busy || !email.trim()}
              onClick={() => void start()}
            >
              {busy ? 'Отправка…' : 'Получить ссылку'}
            </button>
          </>
        )}
        {status && <span className="profile-pass__toast">{status}</span>}
        {sent && (
          <p className="profile-pass__desc">
            <Link to="/">На главную</Link> · <Link to="/profile">Профиль</Link>
          </p>
        )}
      </section>
    </div>
  )
}
