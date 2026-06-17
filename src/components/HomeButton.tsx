import { Link } from 'react-router-dom'
import { Icon } from '../ui/icons'
import { haptic } from '../utils/telegram'
import './HomeButton.css'

type HomeButtonProps = {
  /** If returns true, navigation is prevented (e.g. to show exit confirm). */
  onBeforeNavigate?: () => boolean
  className?: string
}

export default function HomeButton({ onBeforeNavigate, className = '' }: HomeButtonProps) {
  return (
    <Link
      to="/"
      className={`btn btn--ghost home-btn ${className}`.trim()}
      onClick={(e) => {
        haptic('light')
        if (onBeforeNavigate?.()) e.preventDefault()
      }}
      aria-label="Домой"
    >
      <span className="ui-icon-with-text"><Icon name="home" size="sm" /> Домой</span>
    </Link>
  )
}
