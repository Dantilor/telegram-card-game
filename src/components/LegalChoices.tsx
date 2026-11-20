import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { buildAgreementBody, buildChannelActionBody, LegalClientError, userFacingLoadError } from '../legal/client'
import { cachedDocument, invalidateDocument, loadDocument } from '../legal/documentCache'
import { blockAnalyticsTransport } from '../legal/analyticsGate'
import { useLegal } from '../legal/LegalProvider'
import { useTelegramBack } from '../legal/useTelegramBack'
import type { PublicDocument } from '../legal/types'
import './LegalDocumentView.css'

const SHEET_KEY = 'gnh_legal_sheet_closed'

function closedThisSession(): boolean {
  try { return sessionStorage.getItem(SHEET_KEY) === '1' } catch { return false }
}

function rememberClosed(): void {
  try { sessionStorage.setItem(SHEET_KEY, '1') } catch { /* Dismissal is not acceptance. */ }
}

function usePublicDocument(id: string, enabled: boolean) {
  const [document, setDocument] = useState<PublicDocument | null>(() => cachedDocument(id))
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setError(null)
    void loadDocument(id).then((loaded) => {
      if (!cancelled) setDocument(loaded)
    }).catch((reason: unknown) => {
      if (!cancelled) { setDocument(null); setError(userFacingLoadError(reason)) }
    })
    return () => { cancelled = true }
  }, [id, enabled, attempt])
  return {
    document,
    error,
    retry: () => { invalidateDocument(id); setDocument(null); setAttempt((value) => value + 1) },
  }
}

export function FirstUseSheet() {
  const legal = useLegal()
  const [hidden, setHidden] = useState(closedThisSession)
  const [busy, setBusy] = useState(false)
  const saving = useRef(false)
  const [message, setMessage] = useState<string | null>(null)
  // Optional consent must never reopen already accepted terms.
  const needed = legal.status === 'ready' && !hidden && legal.records?.agreement?.active !== true
  const agreement = usePublicDocument('agreement', needed)
  const privacy = usePublicDocument('privacy', needed)
  const close = useCallback(() => { rememberClosed(); setHidden(true) }, [])
  useTelegramBack(needed, close)

  useEffect(() => {
    if (!needed) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [needed])

  if (!needed) return null

  const accept = async () => {
    if (saving.current || !agreement.document || !privacy.document) return
    saving.current = true
    setBusy(true)
    setMessage(null)
    try {
      await legal.postLegal('/api/legal/agreement', buildAgreementBody(agreement.document))
      // The authoritative POST succeeded. Do not wait for a second GET to close.
      close()
      void legal.refreshRecords()
    } catch (reason) {
      if (reason instanceof LegalClientError && reason.code === 'version_mismatch') {
        agreement.retry()
        privacy.retry()
      }
      setMessage(reason instanceof LegalClientError ? userFacingLoadError(reason) : 'Не удалось сохранить выбор. Попробуйте ещё раз.')
    } finally {
      saving.current = false
      setBusy(false)
    }
  }

  return createPortal(
    <div className="legal-choice legal-overlay" role="dialog" aria-modal="true" aria-labelledby="legal-first-title">
      <div className="legal-choice__card">
        <div className="legal-choice__intro">
          <span className="legal-choice__eyebrow">GAMENIGHT HOST</span>
          <h2 id="legal-first-title" className="legal-choice__title">Перед началом игры</h2>
          <p className="legal-choice__lead">Ознакомьтесь с условиями использования и тем, как мы обрабатываем данные.</p>
        </div>
        <div className="legal-choice__links">
          <button type="button" className="legal-choice__document" onClick={() => legal.openDocument('agreement')}>
            <span>Пользовательское соглашение</span><span aria-hidden="true">↗</span>
          </button>
          <button type="button" className="legal-choice__document" onClick={() => legal.openDocument('privacy')}>
            <span>Политика конфиденциальности</span><span aria-hidden="true">↗</span>
          </button>
        </div>
        {(agreement.error || privacy.error) && (
          <div className="legal-choice__feedback" role="alert">
            <p>Не удалось загрузить документы. Проверьте соединение и попробуйте ещё раз.</p>
            <button type="button" className="legal-choice__btn legal-choice__btn--quiet" onClick={() => { agreement.retry(); privacy.retry() }}>Повторить загрузку</button>
          </div>
        )}
        {message && <p className="legal-doc__error" role="alert">{message}</p>}
        <div className="legal-choice__actions">
          <button type="button" className="legal-choice__btn legal-choice__btn--primary" disabled={busy || !agreement.document || !privacy.document} onClick={() => void accept()}>
            {busy ? 'Сохраняем…' : 'Принимаю соглашение'}
          </button>
          <button type="button" className="legal-choice__btn legal-choice__btn--text" disabled={busy} onClick={close}>Позже</button>
        </div>
        <p className="legal-choice__footnote">Документы всегда доступны в профиле. Рекламные подписки не включаются.</p>
      </div>
    </div>, document.body
  )
}

const CONSENT_LABELS: Record<string, string> = {
  pd_account: 'Обработка данных аккаунта',
  analytics: 'Аналитика',
  marketing_permission: 'Рекламные сообщения в Telegram',
  marketing_pd: 'Данные для рассылки в Telegram',
}

/** Keep existing grants readable and revocable, without promoting unused opt-ins. */
export function ConsentsPanel() {
  const legal = useLegal()
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const grants = legal.records?.consents.filter((record) =>
    CONSENT_LABELS[record.documentId] && (record.active || record.state === 'granted')
  ) ?? []
  if (legal.status !== 'ready' || grants.length === 0) return null

  const withdraw = async (id: string, channel: string | null) => {
    if (busy) return
    setBusy(`${id}:${channel ?? ''}`)
    setMessage(null)
    if (id === 'analytics') blockAnalyticsTransport()
    try {
      await legal.postLegal('/api/legal/consents/withdraw', buildChannelActionBody(id, channel === 'telegram' ? channel : undefined))
      await legal.refreshRecords()
    } catch (reason) { setMessage(userFacingLoadError(reason)) }
    finally { setBusy(null) }
  }

  return (
    <details className="profile-menu profile-privacy">
      <summary className="profile-privacy__summary">
        <span><strong>Настройки приватности</strong><small>Ранее выданные согласия</small></span>
        <span className="profile-privacy__chevron" aria-hidden="true">⌄</span>
      </summary>
      <div className="profile-consents">
        {grants.map((record) => {
          const key = `${record.documentId}:${record.channel ?? ''}`
          return <div key={key} className="profile-consents__block">
            <h3 className="profile-consents__title">{CONSENT_LABELS[record.documentId]}</h3>
            <p className="profile-consents__text">{record.documentId === 'analytics' ? 'Сбор аналитики выключен.' : record.active ? 'Согласие действует.' : 'Согласие больше не действует.'}</p>
            <div className="profile-consents__actions">
              <button type="button" className="legal-choice__btn legal-choice__btn--quiet" onClick={() => legal.openDocument(record.documentId, record.version)}>Посмотреть текст</button>
              <button type="button" className="legal-choice__btn legal-choice__btn--quiet" disabled={Boolean(busy)} onClick={() => void withdraw(record.documentId, record.channel)}>{busy === key ? 'Сохраняем…' : 'Отозвать согласие'}</button>
            </div>
          </div>
        })}
        {message && <p className="legal-doc__error" role="alert">{message}</p>}
      </div>
    </details>
  )
}
