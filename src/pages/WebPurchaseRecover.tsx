import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { isWebShell } from '../config/shell'
import { startEmailRecover } from '../lib/webAuth'
import HomeButton from '../components/HomeButton'
import './Profile.css'

/**
 * WEB email login / Premium restore via magic link.
 * Same account system as anonymous sessions + bind — no second identity store.
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
        'Проверьте почту. Мы отправили ссылку для входа, если этот адрес уже подтверждён или связан с покупкой.'
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
          Введите подтверждённую почту — пришлём одноразовую ссылку. Premium и покупки вернутся на
          этом устройстве. Бесплатные игры доступны без входа.
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