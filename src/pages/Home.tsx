import { Link } from 'react-router-dom'
import { haptic } from '../utils/telegram'
import { hapticImpact } from '../utils/haptics'
import ThemeToggle from '../components/ThemeToggle'
import HomeButton from '../components/HomeButton'
import './Home.css'

const APP_FEATURES = [
  'Колоды вопросов',
  'Alias / Крокодил',
  'Мафия',
  'Activity',
  'Саботаж',
  'Викторина',
  'Правда или действие',
]

function Home() {
  return (
    <div className="home-page">
      <div className="home-page__top-row">
        <HomeButton />
        <ThemeToggle />
      </div>

      <section className="home-hero">
        <div className="home-hero__orb" aria-hidden />
        <div className="home-hero__content">
          <h1 className="home-hero__title">GameNight Host</h1>
          <p className="home-hero__subtitle">
            Колоды вопросов, Мафия, Алиас и другие игры
          </p>
          <div className="home-hero__actions">
            <Link
              to="/games"
              className="btn btn--primary home-hero__btn"
              onClick={() => hapticImpact('light')}
            >
              Начать игру
            </Link>
            <Link
              to="/favorites"
              className="btn btn--secondary home-hero__btn"
              onClick={() => haptic('light')}
            >
              Моё избранное
            </Link>
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
    </div>
  )
}

export default Home
