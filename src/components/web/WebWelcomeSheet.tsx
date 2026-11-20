import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isWebShell } from '../../config/shell'
import { buildAgreementBody, LegalClientError, userFacingLoadError } from '../../legal/client'
import { cachedDocument, invalidateDocument, loadDocument } from '../../legal/documentCache'
import { useLegal } from '../../legal/LegalProvider'
import type { PublicDocument } from '../../legal/types'
import { haptic } from '../../utils/telegram'
import './WebWelcomeSheet.css'

const STORAGE_KEY = 'gnh_web_welcome_v1'
const LEGAL_SHEET_KEY = 'gnh_legal_sheet_closed'

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

function usePublicDocument(id: string, enabled: boolean) {
  const [document, setDocument] = useState<PublicDocument | null>(() => cachedDocument(id))
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setError(null)
    void loadDocument(id)
      .then((loaded) => {
        if (!cancelled) setDocument(loaded)
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setDocument(null)
          setError(userFacingLoadError(reason))
        }
      })
    return () => {
      cancelled = true
    }
  }, [id, enabled, attempt])
  return {
    document,
    error,
    retry: () => {
      invalidateDocument(id)
      setDocument(null)
      setAttempt((value) => value + 1)
    },
  }
}

/**
 * Soft first-visit tip for WEB / PWA.
 * Does not replace FirstUseSheet — waits until the original legal sheet is done,
 * then may also show agreement/privacy footnotes + checkbox.
 */
export default function WebWelcomeSheet() {
  const navigate = useNavigate()
  const legal = useLegal()
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const saving = useRef(false)

  const needsAgreement =
    legal.status === 'ready' && legal.records?.agreement?.active !== true
  // Keep the original FirstUseSheet first; welcome follows after accept/later there.
  const firstUseBlocking = needsAgreement && !legalSheetClosedThisSession()
  const agreement = usePublicDocument('agreement', open && needsAgreement)
  const privacy = usePublicDocument('privacy', open && needsAgreement)

  useEffect(() => {
    if (!isWebShell()) return
    if (welcomeSeen()) return
    if (legal.status === 'loading') return
    if (firstUseBlocking) return
    const showTimer = window.setTimeout(() => {
      setOpen(true)
      requestAnimationFrame(() => setVisible(true))
    }, 700)
    return () => window.clearTimeout(showTimer)
  }, [legal.status, firstUseBlocking, legal.records?.agreement?.active])

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

  const accept = useCallback(async () => {
    if (!acceptedTerms || saving.current) return
    if (!needsAgreement) {
      dismiss()
      return
    }
    if (!agreement.document || !privacy.document) return
    saving.current = true
    setBusy(true)
    setMessage(null)
    haptic('medium')
    try {
      await legal.postLegal('/api/legal/agreement', buildAgreementBody(agreement.document))
      void legal.refreshRecords()
      dismiss()
    } catch (reason) {
      if (reason instanceof LegalClientError && reason.code === 'version_mismatch') {
        agreement.retry()
        privacy.retry()
      }
      setMessage(
        reason instanceof LegalClientError
          ? userFacingLoadError(reason)
          : 'Не удалось сохранить выбор. Попробуйте ещё раз.'
      )
    } finally {
      saving.current = false
      setBusy(false)
    }
  }, [acceptedTerms, needsAgreement, agreement, privacy, dismiss, legal])

  if (!open) return null

  const actionsLocked = needsAgreement && !acceptedTerms
  const acceptDisabled =
    actionsLocked ||
    busy ||
    (needsAgreement && (!agreement.document || !privacy.document))

  return (
    <div
      className={`web-welcome${visible ? ' web-welcome--in' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="web-welcome-title"
    >
      <button
        type="button"
        className="web-welcome__backdrop"
        aria-label="Закрыть"
        onClick={() => {
          if (needsAgreement && !acceptedTerms) return
          dismiss()
        }}
      />
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

        {needsAgreement ? (
          <>
            {(agreement.error || privacy.error) && (
              <div className="web-welcome__feedback" role="alert">
                <span>Не удалось загрузить документы.</span>
                <button
                  type="button"
                  className="web-welcome__footnote"
                  onClick={() => {
                    agreement.retry()
                    privacy.retry()
                  }}
                >
                  Повторить
                </button>
              </div>
            )}
            <label className="web-welcome__check">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(event) => setAcceptedTerms(event.target.checked)}
              />
              <span>Принимаю пользовательское соглашение и политику конфиденциальности</span>
            </label>
            {message ? (
              <p className="web-welcome__error" role="alert">
                {message}
              </p>
            ) : null}
            <div className="web-welcome__actions">
              <button
                type="button"
                className="web-welcome__primary"
                disabled={acceptDisabled}
                onClick={() => void accept()}
              >
                {busy ? 'Сохраняем…' : 'Принимаю соглашение'}
              </button>
              <button
                type="button"
                className="web-welcome__ghost"
                disabled={actionsLocked || busy}
                onClick={dismiss}
              >
                Позже
              </button>
            </div>
          </>
        ) : (
          <div className="web-welcome__actions">
            <button type="button" className="web-welcome__primary" onClick={goProfile}>
              Открыть профиль
            </button>
            <button type="button" className="web-welcome__ghost" onClick={dismiss}>
              Понятно
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
