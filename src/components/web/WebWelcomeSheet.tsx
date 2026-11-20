import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isWebShell } from '../../config/shell'
import { useLegal } from '../../legal/LegalProvider'
import { haptic } from '../../utils/telegram'
import './WebWelcomeSheet.css'

const STORAGE_KEY = 'gnh_web_welcome_v1'
const LEGAL_SHEET_KEY = 'gnh_legal_sheet_closed'
export const LEGAL_FIRST_USE_CLOSED_EVENT = 'gnh_legal_first_use_closed'

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
  } catch {
    /* ignore */
  }
}

function legalSheetClosedThisSession(): boolean {
  try {
    return sessionStorage.getItem(LEGAL_SHEET_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Soft first-visit tip for WEB / PWA.
 * Always after the original FirstUseSheet (documents + accept), never instead of it.
 */
export default function WebWelcomeSheet() {
  const navigate = useNavigate()
  const legal = useLegal()
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(false)

  const needsAgreement =
    legal.status === 'ready' && legal.records?.agreement?.active !== true
  const firstUseBlocking = needsAgreement && !legalSheetClosedThisSession()

  const showWelcome = useCallback(() => {
    if (!isWebShell() || welcomeSeen() || open) return
    if (legal.status === 'loading') return
    if (needsAgreement && !legalSheetClosedThisSession()) return
    setOpen(true)
    requestAnimationFrame(() => setVisible(true))
  }, [legal.status, needsAgreement, open])

  useEffect(() => {
    if (!isWebShell()) return
    if (welcomeSeen()) return
    if (legal.status === 'loading') return
    if (firstUseBlocking) return
    // Right after documents sheet — short beat, not a long delay.
    const showTimer = window.setTimeout(() => showWelcome(), 180)
    return () => window.clearTimeout(showTimer)
  }, [legal.status, firstUseBlocking, legal.records?.agreement?.active, showWelcome])

  useEffect(() => {
    if (!isWebShell()) return
    const onLegalClosed = () => {
      window.setTimeout(() => showWelcome(), 120)
    }
    window.addEventListener(LEGAL_FIRST_USE_CLOSED_EVENT, onLegalClosed)
    return () => window.removeEventListener(LEGAL_FIRST_USE_CLOSED_EVENT, onLegalClosed)
  }, [showWelcome])

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
