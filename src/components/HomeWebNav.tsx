import { Link, useLocation } from 'react-router-dom'
import { haptic } from '../utils/telegram'
import { hapticImpact } from '../utils/haptics'
import { requestFullscreenOnUserGesture } from '../lib/telegramTheme'
import './HomeWebNav.css'

type HomeWebNavProps = {
  onPremium?: () => void
}

export default function HomeWebNav({ onPremium }: HomeWebNavProps) {
  const { pathname } = useLocation()
  const gamesActive = pathname.startsWith('/games')
  const profileActive = pathname.startsWith('/profile')
  const premiumActive = pathname.startsWith('/premium')

  return (
    <nav className="home-web-nav" aria-label="Основная навигация">
      <Link to="/" className="home-web-nav__brand" onClick={() => haptic('light')}>
        GameNight Host
      </Link>
      <div className="home-web-nav__links">
        <Link
          to="/games"
          className={`home-web-nav__link${gamesActive ? ' home-web-nav__link--cta is-active' : ''}`}
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
        <Link
          to="/profile"
          className={`home-web-nav__link${profileActive ? ' is-active' : ''}`}
          onClick={() => haptic('light')}
        >
          Профиль
        </Link>
        <Link
          to="/premium"
          className={`home-web-nav__link${premiumActive ? ' is-active' : ''}`}
          onClick={() => haptic('light')}
        >
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
