import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { LegalBlocks } from './LegalBlocks'
import { resolveApiBase } from '../lib/apiBase'
import {
  fetchPublicDocument,
  inAppDocumentPath,
  userFacingLoadError,
} from '../legal/client'
import { useTelegramBack } from '../legal/useTelegramBack'
import type { PublicDocument } from '../legal/types'
import './LegalDocumentView.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; document: PublicDocument }

function appLink(path: string): string {
  const base = import.meta.env.BASE_URL || '/'
  return `${window.location.origin}${base}#${path}`
}

function serverLink(path: string): string | null {
  try {
    return `${resolveApiBase(import.meta.env)}${path}`
  } catch {
    return null
  }
}

export function LegalDocumentPanel({
  documentId,
  version,
  onClose,
}: {
  documentId: string
  version?: string
  onClose?: () => void
}) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  const load = useCallback(() => {
    let cancelled = false
    setState({ status: 'loading' })
    fetchPublicDocument(documentId, version, import.meta.env)
      .then((document) => {
        if (!cancelled) setState({ status: 'ready', document })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setState({
          status: 'error',
          message: userFacingLoadError(error) || 'Утверждённый текст документа недоступен. Подтверждение не сохранено.',
        })
      })
    return () => {
      cancelled = true
    }
  }, [documentId, version])

  useEffect(() => load(), [load, attempt])

  const close = onClose ?? (() => undefined)
  useTelegramBack(Boolean(onClose), close)

  const ready = state.status === 'ready' ? state.document : null
  const activePath = inAppDocumentPath(documentId)
  const versionPath = ready ? inAppDocumentPath(ready.id, ready.version) : null

  return (
    <article className="legal-doc" aria-busy={state.status === 'loading'}>
      <header className="legal-doc__header">
        <div>
          <h1 className="legal-doc__title">{ready?.title ?? 'Документ'}</h1>
          {ready && (
            <p className="legal-doc__meta">
              Редакция {ready.version}
              {ready.documentDate ? ` · ${ready.documentDate}` : ''} · SHA-256 {ready.sha256}
            </p>
          )}
        </div>
        {onClose && (
          <button type="button" className="legal-doc__dismiss" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        )}
      </header>
      <div className="legal-doc__scroll">
        {state.status === 'loading' && <p className="legal-doc__notice">Загрузка утверждённого текста…</p>}
        {state.status === 'error' && (
          <>
            <p className="legal-doc__error">{state.message}</p>
            <button type="button" className="legal-doc__retry" onClick={() => setAttempt((value) => value + 1)}>
              Повторить загрузку
            </button>
          </>
        )}
        {ready && (
          <>
            {ready.requiresIndividualDetails && (
              <p className="legal-doc__notice">
                Это шаблон для одного согласованного материала. Общее подтверждение здесь не принимается, и публикация не включается.
              </p>
            )}
            <LegalBlocks blocks={ready.blocks ?? []} fallbackText={ready.bodyMarkdown} />
            <div className="legal-doc__links">
              <a href={appLink(activePath)}>Актуальная редакция</a>
              {versionPath && <a href={appLink(versionPath)}>Эта редакция {ready.version}</a>}
              {serverLink(ready.links.html) && <a href={serverLink(ready.links.html) as string}>Страница документа</a>}
              {serverLink(ready.links.versionHtml) && (
                <a href={serverLink(ready.links.versionHtml) as string}>Страница редакции {ready.version}</a>
              )}
              {ready.versions
                .filter((item) => item.version !== ready.version)
                .map((item) => (
                  <a key={item.version} href={appLink(inAppDocumentPath(ready.id, item.version))}>
                    Архив редакции {item.version}
                  </a>
                ))}
            </div>
          </>
        )}
      </div>
      {onClose && (
        <footer className="legal-doc__footer">
          <button type="button" className="legal-doc__close" onClick={onClose}>
            Закрыть
          </button>
        </footer>
      )}
    </article>
  )
}

export function LegalDocumentModal({
  documentId,
  version,
  onClose,
}: {
  documentId: string
  version?: string
  onClose: () => void
}) {
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  return createPortal(
    <div className="legal-doc-modal" role="dialog" aria-modal="true">
      <div className="legal-doc-modal__card">
        <LegalDocumentPanel documentId={documentId} version={version} onClose={onClose} />
      </div>
    </div>,
    document.body
  )
}
