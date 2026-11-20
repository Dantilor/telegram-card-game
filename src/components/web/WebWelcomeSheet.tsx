import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { isWebShell } from '../../config/shell'
import { useLegal } from '../../legal/LegalProvider'
import { haptic } from '../../utils/telegram'
import './WebWelcomeSheet.css'

const STORAGE_KEY = 'gnh_web_welcome_v1'
const PENDING_KEY = 'gnh_web_welcome_pending'

export function markWebWelcomePending(): void {
  try {
    if (localStorage.getItem(STORAGE_KEY) === '1') return
    sessionStorage.setItem(PENDING_KEY, '1')
  } catch {
    /* ignore */
  }
}

function welcomeSeen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return true
  }
}

function markWelcomeSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
    sessionStorage.removeItem(PENDING_KEY)
  } catch {
    /* ignore */
  }
}

function welcomePending(): boolean {
  try {
    return sessionStorage.getItem(PENDING_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Soft tip for WEB / PWA after the user taps «Начать игру» on the home screen.
 * Does not replace FirstUseSheet.
 */
export default function WebWelcomeSheet() {
  const navigate = useNavigate()
  const location = useLocation()
  const legal = useLegal()
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isWebShell()) return
    if (welcomeSeen() || open) return
    if (!welcomePending()) return
    // Show on the catalog transition after «Начать игру».
    if (location.pathname !== '/games') return
    const showTimer = window.setTimeout(() => {
      setOpen(true)
      requestAnimationFrame(() => setVisible(true))
    }, 220)
    return () => window.clearTimeout(showTimer)
  }, [location.pathname, open])

  const dismiss = useCallback(() => {
    setVisible(false)
    window.setTimeout(() => {
      setOpen(false)
      markWelcomeSeen()
    }, 280)
  }, [])

  const goProfile = useCallback(() => {
    haptic('light')
    dismiss()
    navigate('/profile')
  }, [dismiss, navigate])

  if (!open) return null

  return (
    <div
      className={`web-welcome${visible ? ' web-welcome--in' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="web-welcome-title"
    >
      <button type="button" className="web-welcome__backdrop" aria-label="Закрыть" onClick={dismiss} />
      <div className="web-welcome__card">
        <p className="web-welcome__eyebrow">GameNight Host</p>
        <h2 id="web-welcome-title" className="web-welcome__title">
          Добро пожаловать
        </h2>
        <p className="web-welcome__text">
          Если у вас уже есть Premium в Telegram — откройте профиль и нажмите «Восстановить через
          Telegram». Подписка появится на сайте без повторной оплаты.
        </p>
        <p className="web-welcome__text">
          Если покупаете здесь впервые — сохраните email в профиле, чтобы не потерять Premium при
          следующем входе.
        </p>
        <p className="web-welcome__footnotes">
          <button
            type="button"
            className="web-welcome__footnote"
            onClick={() => legal.openDocument('agreement')}
          >
            Пользовательское соглашение
          </button>
          <span aria-hidden="true"> · </span>
          <button
            type="button"
            className="web-welcome__footnote"
            onClick={() => legal.openDocument('privacy')}
          >
            Политика конфиденциальности
          </button>
        </p>
        <div className="web-welcome__actions">
          <button type="button" className="web-welcome__primary" onClick={goProfile}>
            Открыть профиль
          </button>
          <button type="button" className="web-welcome__ghost" onClick={dismiss}>
            Понятно
          </button>
        </div>
      </div>
    </div>
  )
}
