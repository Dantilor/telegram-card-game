import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { haptic } from '../utils/telegram'
import ThemeToggle from '../components/ThemeToggle'
import HomeButton from '../components/HomeButton'
import './Home.css'

const PREFETCH_KEY = 'PREFETCHED_PLAY'

const COMING_SOON = [
  { id: 'quiz', title: 'Викторины', label: 'в разработке' },
  { id: 'battles', title: 'Баттлы', label: 'в разработке' },
  { id: 'stories', title: 'Истории', label: 'в разработке' },
]

function Home() {
  useEffect(() => {
    try {
      if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(PREFETCH_KEY) !== '1') {
        import('./Play').then(() => {
          try {
            sessionStorage.setItem(PREFETCH_KEY, '1')
          } catch {
            // ignore
          }
        }).catch(() => {})
      }
    } catch {
      // ignore
    }
  }, [])

  return (
    <div className="home-page">
      <div className="home-page__top-row">
        <HomeButton />
        <ThemeToggle />
      </div>

      <section className="home-hero">
        <div className="home-hero__orb" aria-hidden />
        <div className="home-hero__content">
          <h1 className="home-hero__title">Card Game</h1>
          <p className="home-hero__subtitle">
            Колоды вопросов для пар, друзей и вечеринок
          </p>
          <div className="home-hero__actions">
            <Link
              to="/decks"
              className="btn btn--primary home-hero__btn"
              onClick={() => haptic('light')}
            >
              Начать игру
            </Link>
            <Link
              to="/decks/custom"
              className="btn btn--secondary home-hero__btn"
              onClick={() => haptic('light')}
            >
              Мои колоды
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

      <section className="home-coming">
        <h2 className="home-coming__title">Скоро</h2>
        <ul className="home-coming__list">
          {COMING_SOON.map((item) => (
            <li key={item.id} className="home-coming__card card">
              <span className="home-coming__card-title">{item.title}</span>
              <span className="home-coming__card-label">{item.label}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

export default Home
