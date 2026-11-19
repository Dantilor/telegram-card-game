import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { isWebShell } from '../config/shell'
import { completeEmailMagicLink } from '../lib/webAuth'
import { useWebSession } from '../shell/WebSessionContext'
import { usePremium } from '../contexts/PremiumContext'
import HomeButton from '../components/HomeButton'
import './Profile.css'

/**
 * Magic-link landing. Does NOT auto-complete on mount (mail prefetch safe).
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

  const confirm = useCallback(async () => {
    if (!token) {
      setStatus('Ссылка неполная. Запросите новое письмо.')
      return
    }
    setBusy(true)
    setStatus(null)
    try {
      await completeEmailMagicLink(token)
      await webSession.refreshSession()
      await refreshPremium()
      setDone(true)
      setStatus('Готово. Premium и профиль восстановлены.')
      navigate('/profile', { replace: true })
    } catch {
      setStatus('Ссылка недействительна или уже использована. Запросите новую на /recover.')
    } finally {
      setBusy(false)
    }
  }, [token, webSession, refreshPremium, navigate])

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
      <section className="profile-pass">
        <p className="profile-pass__eyebrow">GameNight Host</p>
        <p className="profile-pass__title">Подтверждение почты</p>
        <p className="profile-pass__desc">
          Нажмите кнопку ниже, чтобы войти и подтвердить адрес. Письмо само по себе ничего не
          активирует — это защита от автоматического открытия ссылки почтовым клиентом.
        </p>
        <button
          type="button"
          className="profile-pass__cta"
          disabled={busy || done || !token}
          onClick={() => void confirm()}
        >
          {busy ? 'Вход…' : done ? 'Готово' : 'Подтвердить и войти'}
        </button>
        {status && <span className="profile-pass__toast">{status}</span>}
        <p className="profile-pass__desc">
          <Link to="/recover">Запросить новую ссылку</Link>
        </p>
      </section>
    </div>
  )
}
