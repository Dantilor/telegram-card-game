import type React from 'react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { getDocument, DOCUMENT_TITLES, type DocumentType } from '../data/documents'
import { getTelegramWebApp } from '../lib/telegram'
import { haptic } from '../utils/telegram'
import './DocumentModal.css'

const SUPPORT_BOT_URL = 'https://t.me/GameNightHelp'

function parseDocument(text: string): React.ReactNode[] {
  const blocks = text.split(/\n\n+/).filter(Boolean)
  const result: React.ReactNode[] = []

  for (const block of blocks) {
    const trimmed = block.trim()
    if (!trimmed) continue

    if (trimmed.startsWith('## ')) {
      result.push(
        <h2 key={result.length} className="document-modal__h2">
          {trimmed.slice(3)}
        </h2>
      )
      continue
    }

    const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean)
    const listItems = lines.filter((l) => l.startsWith('• '))

    if (listItems.length === lines.length && listItems.length > 0) {
      result.push(
        <ul key={result.length} className="document-modal__ul">
          {listItems.map((item, i) => (
            <li key={i} className="document-modal__li">
              {formatInline(item.slice(2))}
            </li>
          ))}
        </ul>
      )
    } else {
      result.push(
        <p key={result.length} className="document-modal__p">
          {formatInline(trimmed)}
        </p>
      )
    }
  }
  return result
}

function formatInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const match = text.match(/@(\w+)/)
  if (match) {
    const idx = text.indexOf(match[0])
    if (idx > 0) parts.push(text.slice(0, idx))
    parts.push(
      <button
        key="link"
        type="button"
        className="document-modal__link"
        onClick={() => {
          haptic('light')
          const tg = getTelegramWebApp()
          if (tg?.openTelegramLink) {
            tg.openTelegramLink(SUPPORT_BOT_URL)
          } else {
            window.open(SUPPORT_BOT_URL, '_blank', 'noopener,noreferrer')
          }
        }}
      >
        {match[0]}
      </button>
    )
    if (idx + match[0].length < text.length) {
      parts.push(text.slice(idx + match[0].length))
    }
  } else {
    parts.push(text)
  }
  return parts
}

type Props = {
  isOpen: boolean
  onClose: () => void
  documentType: DocumentType
}

export default function DocumentModal({ isOpen, onClose, documentType }: Props) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose()
      }
      document.addEventListener('keydown', handleEsc)
      return () => document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const title = DOCUMENT_TITLES[documentType]
  const content = getDocument(documentType)
  const nodes = parseDocument(content)

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      haptic('light')
      onClose()
    }
  }

  return createPortal(
    <div
      className="document-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="document-modal-title"
      onClick={handleBackdropClick}
    >
      <div className="document-modal__card" onClick={(e) => e.stopPropagation()}>
        <div className="document-modal__header">
          <h1 id="document-modal-title" className="document-modal__title">
            {title}
          </h1>
          <button
            type="button"
            className="document-modal__close"
            onClick={() => {
              haptic('light')
              onClose()
            }}
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>
        <div className="document-modal__scroll">
          <div className="document-modal__content">{nodes}</div>
        </div>
        <div className="document-modal__footer">
          <button
            type="button"
            className="btn btn--primary document-modal__btn"
            onClick={() => {
              haptic('light')
              onClose()
            }}
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
