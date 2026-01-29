import { Link } from 'react-router-dom'
import { haptic } from '../utils/telegram'
import './HomeButton.css'

export default function HomeButton() {
  return (
    <Link
      to="/"
      className="btn btn--ghost home-btn"
      onClick={() => haptic('light')}
      aria-label="Домой"
    >
      🏠 Домой
    </Link>
  )
}
