import { Icon } from '../ui/icons'
import { haptic } from '../utils/telegram'
import './HomeButton.css'

type BackButtonProps = {
  onClick: () => void
  /** Page-specific class for layout (e.g. card-entry-page__back, games-page__back) */
  className: string
  /** Label, default "Назад" */
  children?: React.ReactNode
}

export default function BackButton({ onClick, className, children = 'Назад' }: BackButtonProps) {
  return (
    <button
      type="button"
      className={`btn btn--ghost home-btn ${className}`}
      onClick={() => {
        haptic('light')
        onClick()
      }}
      aria-label="Назад"
    >
      <span className="ui-icon-with-text">
        <Icon name="arrow-left" size="sm" />
        {children}
      </span>
    </button>
  )
}
