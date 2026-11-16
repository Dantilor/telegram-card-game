import { Link } from 'react-router-dom'
import { haptic } from '../utils/telegram'
import { hapticImpact } from '../utils/haptics'
import { requestFullscreenOnUserGesture } from '../lib/telegramTheme'
import './HomeWebNav.css'

type HomeWebNavProps = {
  onPremium?: () => void
}

/**
 * Desktop-only chrome for standalone WEB Home (hidden on narrow viewports via CSS).
 */
export default function HomeWebNav({ onPremium }: HomeWebNavProps) {
  return (
    <nav className="home-web-nav" aria-label="Основная навигация">
      <Link to="/" className="home-web-nav__brand" onClick={() => haptic('light')}>
        GameNight Host
      </Link>
      <div className="home-web-nav__links">
        <Link
          to="/games"
          className="home-web-nav__link home-web-nav__link--cta"
          onClick={() => {
            hapticImpact('light')
            requestFullscreenOnUserGesture()
          }}
          onPointerEnter={() => {
            void import('../pages/Games')
          }}
        >
          Каталог игр
        </Link>
        <Link to="/profile" className="home-web-nav__link" onClick={() => haptic('light')}>
          Профиль
        </Link>
        <Link to="/premium" className="home-web-nav__link" onClick={() => haptic('light')}>
          Premium
        </Link>
        {onPremium ? (
          <button type="button" className="home-web-nav__link" onClick={onPremium}>
            Тарифы
          </button>
        ) : null}
      </div>
    </nav>
  )
}
