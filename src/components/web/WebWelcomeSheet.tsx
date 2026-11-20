import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isWebShell } from '../../config/shell'
import { haptic } from '../../utils/telegram'
import './WebWelcomeSheet.css'

const STORAGE_KEY = 'gnh_web_welcome_v1'

/**
 * Soft first-visit tip for WEB / PWA — not a hard gate.
 */
export default function WebWelcomeSheet() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isWebShell()) return
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') return
    } catch {
      return
    }
    const showTimer = window.setTimeout(() => {
      setOpen(true)
      requestAnimationFrame(() => setVisible(true))
    }, 700)
    return () => window.clearTimeout(showTimer)
  }, [])

  const dismiss = useCallback(() => {
    setVisible(false)
    window.setTimeout(() => {
      setOpen(false)
      try {
        localStorage.setItem(STORAGE_KEY, '1')
      } catch {
        /* ignore */
      }
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
