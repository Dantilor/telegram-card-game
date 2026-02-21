import { useState } from 'react'
import { Link } from 'react-router-dom'
import { haptic } from '../utils/telegram'
import { hapticImpact } from '../utils/haptics'
import { usePremium } from '../contexts/PremiumContext'
import { isFavoritesLocked } from '../utils/access'
import ThemeToggle from '../components/ThemeToggle'
import PremiumOverlay from '../components/PremiumOverlay'
import './Home.css'

const APP_FEATURES = [
  'Колоды вопросов',
  'Ассоциации',
  'Мафия',
  'Активитус',
  'Саботаж',
  'Викторина',
  'Правда или действие',
]

function Home() {
  const { isPremium } = usePremium()
  const [premiumOverlayOpen, setPremiumOverlayOpen] = useState(false)
  const favoritesLocked = isFavoritesLocked(isPremium)

  return (
    <div className="home-page">
      <div className="home-page__top-row">
        <ThemeToggle onPremiumRequired={() => setPremiumOverlayOpen(true)} />
      </div>

      <section className="home-hero">
        <div className="home-hero__orb" aria-hidden />
        <div className="home-hero__content">
          <h1 className="home-hero__title">GameNight Host</h1>
          <div className="home-hero__actions">
            <Link
              to="/games"
              className="btn btn--primary home-hero__btn"
              onClick={() => hapticImpact('light')}
            >
              Начать раунд
            </Link>
            {favoritesLocked ? (
              <button
                type="button"
                className="btn btn--secondary home-hero__btn"
                onClick={() => {
                  haptic('light')
                  setPremiumOverlayOpen(true)
                }}
              >
                Моё избранное
              </button>
            ) : (
              <Link
                to="/favorites"
                className="btn btn--secondary home-hero__btn"
                onClick={() => haptic('light')}
              >
                Моё избранное
              </Link>
            )}
            <Link
              to="/profile"
              className="btn btn--secondary home-hero__btn"
              onClick={() => haptic('light')}
            >
              Профиль
            </Link>
          </div>
        </div>
      </section>

      <section className="home-about">
        <h2 className="home-about__subtitle">Игры для компании, пары и вечеринок</h2>
        <div className="home-about__chips">
          {APP_FEATURES.map((label) => (
            <span key={label} className="home-about__chip">
              {label}
            </span>
          ))}
        </div>
        <p className="home-about__text">
          Выбирай игру → настрой режим → играй. Избранные вопросы сохраняются.
        </p>
      </section>
      <PremiumOverlay isOpen={premiumOverlayOpen} onClose={() => setPremiumOverlayOpen(false)} />
    </div>
  )
}

export default Home
