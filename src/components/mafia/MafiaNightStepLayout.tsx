import type { ReactNode } from 'react'
import './MafiaNightStepLayout.css'

export type MafiaNightStepLayoutProps = {
  stepTitle: string
  roleTitle?: string | null
  description?: string | null
  statusBlock?: ReactNode
  primaryButtonLabel: string
  primaryButtonOnClick: () => void
  primaryButtonDisabled?: boolean
  children?: ReactNode
}

/**
 * Единый layout для ночных шагов Мафии: одна центральная карточка,
 * фиксированный вертикальный ритм, скролл только в области списка игроков,
 * кнопка всегда внизу карточки.
 */
export function MafiaNightStepLayout({
  stepTitle,
  roleTitle,
  description,
  statusBlock,
  primaryButtonLabel,
  primaryButtonOnClick,
  primaryButtonDisabled = false,
  children,
}: MafiaNightStepLayoutProps) {
  return (
    <div className="mafia-night-step">
      {stepTitle !== '' && (
        <p className="mafia-night-step__label" aria-live="polite">
          {stepTitle}
        </p>
      )}
      <div className="mafia-night-step__card card">
        {(roleTitle != null && roleTitle !== '') && (
          <h2 className="mafia-night-step__role">{roleTitle}</h2>
        )}
        {(description != null && description !== '') && (
          <p className="mafia-night-step__description">{description}</p>
        )}
        {children != null && (
          <div className="mafia-night-step__content">
            {children}
          </div>
        )}
        <footer className="mafia-night-step__footer">
          {statusBlock != null && (
            <div className="mafia-night-step__status">
              {statusBlock}
            </div>
          )}
          <button
            type="button"
            className="btn btn--primary mafia-night-step__btn"
            onClick={primaryButtonOnClick}
            disabled={primaryButtonDisabled}
          >
            {primaryButtonLabel}
          </button>
        </footer>
      </div>
    </div>
  )
}
