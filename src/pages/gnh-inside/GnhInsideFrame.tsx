import { useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { isFavoritesLocked } from '../../utils/access'
import { usePremium } from '../../contexts/PremiumContext'
import { haptic } from '../../utils/telegram'
import { hapticImpact } from '../../utils/haptics'
import { requestFullscreenOnUserGesture } from '../../lib/telegramTheme'
import PremiumOverlay from '../../components/PremiumOverlay'
import WebSiteFooter from '../../components/web/WebSiteFooter'
import markUrl from './assets/reference-mark.webp'
import './styles/fonts.css'
import './styles/inside-scoped.css'
import './inside-bridge.css'
import '../../styles/web-layout.css'

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  )
}

function isCatalogPath(path: string) {
  return /^\/(games|comics|card|mode|decks|game)(\/|$)/.test(path)
}

export default function GnhInsideFrame({ children }: { children: ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { isPremium } = usePremium()
  const favoritesLocked = isFavoritesLocked(isPremium)
  const [premiumOpen, setPremiumOpen] = useState(false)
  const path = location.pathname
  const catalog = isCatalogPath(path)
  const favorites = path === '/favorites' || path.startsWith('/decks/custom')
  const profile = path === '/profile'
  const premium = path === '/premium'
  const wheel = path === '/wheel'
  const kitExperience = premium || wheel

  const openFavorites = () => {
    haptic('light')
    if (favoritesLocked) setPremiumOpen(true)
    else navigate('/favorites')
  }

  return (
    <div className={`gnh-inside${kitExperience ? ' gnh-inside--kit-experience' : ''}`}>
      {!kitExperience ? <div className="ambient-layer" aria-hidden="true" /> : null}
      {!kitExperience ? (
        <header className="app-header">
          <div className="header-inner">
            <Link to="/" className="brand" onClick={() => haptic('light')} aria-label="GameNight Host">
              <img src={markUrl} alt="" width={44} height={44} />
              <span>GNH</span>
            </Link>
            <nav className="header-nav" aria-label="Главная навигация">
              <Link
                to="/games"
                className={catalog ? 'active' : undefined}
                onClick={() => {
                  hapticImpact('light')
                  requestFullscreenOnUserGesture()
                }}
              >
                Каталог
              </Link>
              <button type="button" className={favorites ? 'active' : undefined} onClick={openFavorites}>
                Избранное
              </button>
              <Link to="/profile" className={profile ? 'active' : undefined} onClick={() => haptic('light')}>
                Профиль
              </Link>
            </nav>
            <Link to="/premium" className={`premium-nav${premium ? ' active' : ''}`} onClick={() => haptic('light')}>
              <Icon>
                <path d="m3 8 4-5h10l4 5-9 13L3 8Z" />
                <path d="M3 8h18M7 3l5 18 5-18" />
              </Icon>
              Premium
            </Link>
          </div>
        </header>
      ) : null}
      <main className="content">{children}</main>
      {!kitExperience ? (
        <>
          <WebSiteFooter />
          <nav className="bottom-nav" aria-label="Нижняя навигация">
            <Link to="/" className={path === '/' ? 'active' : undefined} onClick={() => haptic('light')}>
              <Icon>
                <path d="M4 11.2 12 4l8 7.2" />
                <path d="M7 10.5V19h10v-8.5" />
              </Icon>
              Главная
            </Link>
            <Link
              to="/games"
              className={catalog ? 'active' : undefined}
              onClick={() => {
                hapticImpact('light')
                requestFullscreenOnUserGesture()
              }}
            >
              <Icon>
                <rect x="4" y="4" width="7" height="7" rx="1.4" />
                <rect x="13" y="4" width="7" height="7" rx="1.4" />
                <rect x="4" y="13" width="7" height="7" rx="1.4" />
                <rect x="13" y="13" width="7" height="7" rx="1.4" />
              </Icon>
              Каталог
            </Link>
            <button type="button" className={favorites ? 'active' : undefined} onClick={openFavorites}>
              <Icon>
                <path d="M12 3.6 14.1 8.4 19.2 9l-3.8 3.4.9 5.1L12 15.1 7.7 17.5l.9-5.1L4.8 9l5.1-.6L12 3.6Z" />
              </Icon>
              Избранное
            </button>
            <Link to="/profile" className={profile ? 'active' : undefined} onClick={() => haptic('light')}>
              <Icon>
                <circle cx="12" cy="8" r="3" />
                <path d="M5.5 19.2a6.5 6.5 0 0 1 13 0" />
              </Icon>
              Профиль
            </Link>
            <Link to="/premium" className={premium ? 'active' : undefined} onClick={() => haptic('light')}>
              <Icon>
                <path d="m3 8 4-5h10l4 5-9 13L3 8Z" />
                <path d="M3 8h18M7 3l5 18 5-18" />
              </Icon>
              Premium
            </Link>
          </nav>
        </>
      ) : null}
      <PremiumOverlay isOpen={premiumOpen} onClose={() => setPremiumOpen(false)} />
    </div>
  )
}