import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { haptic } from '../utils/telegram'
import '../styles/GamePageShell.css'

type Props = {
  title?: string
  hint: string
  confirmLabel?: string
  titleId?: string
  onCancel: () => void
  onConfirm: () => void
}

export default function GameExitConfirmModal({
  title = 'Выйти из игры?',
  hint,
  confirmLabel = 'Выйти',
  titleId = 'game-exit-title',
  onCancel,
  onConfirm,
}: Props) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  return createPortal(
    <div
      className="game-page__modal-overlay"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="game-page__modal game-page__panel game-page__panel--glow-b"
        onClick={(e) => e.stopPropagation()}
      >
        <p id={titleId} className="game-page__modal-text">
          {title}
        </p>
        <p className="game-page__modal-hint">{hint}</p>
        <div className="game-page__modal-buttons">
          <button
            type="button"
            className="game-page__btn game-page__btn--secondary"
            onClick={() => {
              haptic('light')
              onCancel()
            }}
          >
            Остаться
          </button>
          <button
            type="button"
            className="game-page__cta"
            onClick={() => {
              haptic('light')
              onConfirm()
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
