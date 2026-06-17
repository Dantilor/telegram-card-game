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
  const hasMain = (roleTitle != null && roleTitle !== '') || (description != null && description !== '')
  const statusOnly = children == null && !hasMain && statusBlock != null

  const cardClass = statusOnly
    ? ' mafia-night-step__card--status-only'
    : children == null
      ? ' mafia-night-step__card--centered'
      : ' mafia-night-step__card--list'

  return (
    <div className="mafia-night-step">
      {stepTitle !== '' && (
        <p className="mafia-night-step__label" aria-live="polite">
          {stepTitle}
        </p>
      )}
      <div className={`mafia-night-step__card mafia-page__panel mafia-page__panel--glow-b${cardClass}`}>
        <div className="mafia-night-step__main">
          {(roleTitle != null && roleTitle !== '') && (
            <h2 className="mafia-night-step__role">{roleTitle}</h2>
          )}
          {(description != null && description !== '') && (
            <p className="mafia-night-step__description">{description}</p>
          )}
        </div>
        {children != null && (
          <div className="mafia-night-step__content">
            {children}
          </div>
        )}
        {statusOnly ? (
          <>
            <div className="mafia-night-step__status-center">
              <div className="mafia-night-step__status">
                {statusBlock}
              </div>
            </div>
            <footer className="mafia-night-step__footer">
              <button
                type="button"
                className="mafia-page__cta mafia-night-step__btn"
                onClick={primaryButtonOnClick}
                disabled={primaryButtonDisabled}
              >
                {primaryButtonLabel}
              </button>
            </footer>
          </>
        ) : (
          <footer className="mafia-night-step__footer">
            {statusBlock != null && (
              <div className="mafia-night-step__status">
                {statusBlock}
              </div>
            )}
            <button
              type="button"
              className="mafia-page__cta mafia-night-step__btn"
              onClick={primaryButtonOnClick}
              disabled={primaryButtonDisabled}
            >
              {primaryButtonLabel}
            </button>
          </footer>
        )}
      </div>
    </div>
  )
}
