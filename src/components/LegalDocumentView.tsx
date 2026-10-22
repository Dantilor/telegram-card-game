import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LegalBlocks } from './LegalBlocks'
import { cachedDocument, invalidateDocument, loadDocument } from '../legal/documentCache'
import { useTelegramBack } from '../legal/useTelegramBack'
import type { PublicDocument } from '../legal/types'
import './LegalDocumentView.css'

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; document: PublicDocument }
const TITLES: Record<string, string> = {
  privacy: 'Конфиденциальность', agreement: 'Условия использования', offer: 'Оферта Premium',
  pd_account: 'Персональные данные', analytics: 'Согласие на аналитику',
  marketing_permission: 'Рекламные сообщения', marketing_pd: 'Данные для рассылки',
}

function initialState(id: string, version?: string): LoadState {
  const document = cachedDocument(id, version)
  return document ? { status: 'ready', document } : { status: 'loading' }
}

function documentDate(document: PublicDocument): string | null {
  // Older API responses contain a shortened date such as "Tue Oct 20".
  // Use only a complete ISO date, never infer a year from that display string.
  const raw = document.documentDate?.match(/^\d{4}-\d{2}-\d{2}/)?.[0]
    ?? document.version.match(/^\d{4}-\d{2}-\d{2}/)?.[0]
  if (!raw) return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  })
}

export function LegalDocumentPanel({ documentId, version, onClose }: {
  documentId: string; version?: string; onClose?: () => void
}) {
  const [state, setState] = useState<LoadState>(() => initialState(documentId, version))
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    setState(initialState(documentId, version))
    void loadDocument(documentId, version).then((document) => {
      if (!cancelled) setState({ status: 'ready', document })
    }).catch(() => {
      if (!cancelled) setState({ status: 'error' })
    })
    return () => { cancelled = true }
  }, [documentId, version, attempt])

  const close = useCallback(() => onClose?.(), [onClose])
  useTelegramBack(Boolean(onClose), close)
  const ready = state.status === 'ready' ? state.document : null
  const date = ready ? documentDate(ready) : null

  return (
    <article className="legal-doc" aria-busy={state.status === 'loading'}>
      <header className="legal-doc__header">
        <div className="legal-doc__heading">
          <h2 className="legal-doc__title">{TITLES[documentId] ?? 'Документ'}</h2>
          {date && <p className="legal-doc__meta">Редакция от {date}</p>}
        </div>
        {onClose && <button type="button" className="legal-doc__dismiss" onClick={onClose} aria-label="Закрыть документ">✕</button>}
      </header>
      <div className="legal-doc__scroll" tabIndex={0}>
        {state.status === 'loading' && <div className="legal-doc__skeleton" role="status" aria-label="Загрузка документа">
          <span /><span /><span /><span /><span /><span /><span />
        </div>}
        {state.status === 'error' && <div className="legal-doc__empty" role="alert">
          <h3>Документ не загрузился</h3>
          <p>Проверьте соединение и попробуйте ещё раз.</p>
          <button type="button" className="legal-doc__retry" onClick={() => {
            invalidateDocument(documentId, version)
            setAttempt((value) => value + 1)
          }}>Повторить загрузку</button>
        </div>}
        {ready && <>
          {ready.requiresIndividualDetails && <p className="legal-doc__notice">Этот документ оформляется отдельно для конкретного материала.</p>}
          <LegalBlocks blocks={ready.blocks ?? []} fallbackText={ready.bodyMarkdown} />
        </>}
      </div>
      {onClose && <footer className="legal-doc__footer"><button type="button" className="legal-doc__close" onClick={onClose}>Закрыть документ</button></footer>}
    </article>
  )
}

export function LegalDocumentModal({ documentId, version, onClose }: {
  documentId: string; version?: string; onClose: () => void
}) {
  const dialog = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.body.style.overflow
    const focused = document.activeElement
    document.body.style.overflow = 'hidden'
    dialog.current?.focus({ preventScroll: true })
    return () => {
      document.body.style.overflow = previous
      if (focused instanceof HTMLElement && focused.isConnected) focused.focus({ preventScroll: true })
    }
  }, [])

  return createPortal(
    <div ref={dialog} className="legal-doc-modal legal-overlay" role="dialog" aria-modal="true" aria-label={TITLES[documentId] ?? 'Документ'} tabIndex={-1} onKeyDown={(event) => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose() }
    }}>
      <div className="legal-doc-modal__card"><LegalDocumentPanel documentId={documentId} version={version} onClose={onClose} /></div>
    </div>, document.body
  )
}
