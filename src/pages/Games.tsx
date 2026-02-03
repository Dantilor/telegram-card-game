import { Link, useNavigate } from 'react-router-dom'
import { GAMES } from '../data/games'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import './Games.css'

function Games() {
  const navigate = useNavigate()

  const handleBack = () => {
    haptic('light')
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/')
    }
  }

  return (
    <div className="games-page">
      <div className="games-page__top">
        <HomeButton />
        <button type="button" className="btn btn--ghost games-page__back" onClick={handleBack}>
          ← Назад
        </button>
      </div>
      <header className="games-page__header">
        <h1 className="games-page__title">GameNight Host</h1>
        <p className="games-page__tagline">Выбери игру</p>
      </header>
      <div className="games-grid">
        {GAMES.map((game, i) => {
          const isReady = game.status === 'ready'
          if (isReady && game.id === 'card') {
            return (
              <Link
                key={game.id}
                to="/card"
                className="games-grid__card card games-grid__card--ready tile--active"
                style={{ animationDelay: `${i * 0.05}s` }}
                onClick={() => hapticSelection()}
              >
                <span className="games-grid__emoji" aria-hidden>{game.emoji}</span>
                <h2 className="games-grid__title">{game.title}</h2>
                <p className="games-grid__desc">{game.description}</p>
              </Link>
            )
          }
          if (isReady && game.id === 'alias') {
            return (
              <Link
                key={game.id}
                to="/alias"
                className="games-grid__card card games-grid__card--ready tile--active"
                style={{ animationDelay: `${i * 0.05}s` }}
                onClick={() => hapticSelection()}
              >
                <span className="games-grid__emoji" aria-hidden>{game.emoji}</span>
                <h2 className="games-grid__title">{game.title}</h2>
                <p className="games-grid__desc">{game.description}</p>
              </Link>
            )
          }
          if (isReady && game.id === 'activity') {
            return (
              <Link
                key={game.id}
                to="/activity"
                className="games-grid__card card games-grid__card--ready tile--active"
                style={{ animationDelay: `${i * 0.05}s` }}
                onClick={() => hapticSelection()}
              >
                <span className="games-grid__emoji" aria-hidden>{game.emoji}</span>
                <h2 className="games-grid__title">{game.title}</h2>
                <p className="games-grid__desc">{game.description}</p>
              </Link>
            )
          }
          if (isReady && game.id === 'mafia') {
            return (
              <Link
                key={game.id}
                to="/mafia"
                className="games-grid__card card games-grid__card--ready tile--active"
                style={{ animationDelay: `${i * 0.05}s` }}
                onClick={() => hapticSelection()}
              >
                <span className="games-grid__emoji" aria-hidden>{game.emoji}</span>
                <h2 className="games-grid__title">{game.title}</h2>
                <p className="games-grid__desc">{game.description}</p>
              </Link>
            )
          }
          if (isReady && game.id === 'quiz') {
            return (
              <Link
                key={game.id}
                to="/quiz"
                className="games-grid__card card games-grid__card--ready tile--active"
                style={{ animationDelay: `${i * 0.05}s` }}
                onClick={() => hapticSelection()}
              >
                <span className="games-grid__emoji" aria-hidden>{game.emoji}</span>
                <h2 className="games-grid__title">{game.title}</h2>
                <p className="games-grid__desc">{game.description}</p>
              </Link>
            )
          }
          if (isReady && game.id === 'truth-dare') {
            return (
              <Link
                key={game.id}
                to="/truth-dare"
                className="games-grid__card card games-grid__card--ready tile--active"
                style={{ animationDelay: `${i * 0.05}s` }}
                onClick={() => hapticSelection()}
              >
                <span className="games-grid__emoji" aria-hidden>{game.emoji}</span>
                <h2 className="games-grid__title">{game.title}</h2>
                <p className="games-grid__desc">{game.description}</p>
              </Link>
            )
          }
          if (isReady && game.id === 'sabotage') {
            return (
              <Link
                key={game.id}
                to="/sabotage"
                className="games-grid__card card games-grid__card--ready tile--active"
                style={{ animationDelay: `${i * 0.05}s` }}
                onClick={() => hapticSelection()}
              >
                <span className="games-grid__emoji" aria-hidden>{game.emoji}</span>
                <h2 className="games-grid__title">{game.title}</h2>
                <p className="games-grid__desc">{game.description}</p>
              </Link>
            )
          }
          return (
            <button
              key={game.id}
              type="button"
              className="games-grid__card card games-grid__card--stub"
              style={{ animationDelay: `${i * 0.05}s` }}
              onClick={() => {
                hapticSelection()
                navigate(`/game/${game.id}`)
              }}
            >
              <span className="games-grid__emoji" aria-hidden>{game.emoji}</span>
              <h2 className="games-grid__title">{game.title}</h2>
              <p className="games-grid__desc">{game.description}</p>
              <span className="badge badge--soon">SOON</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default Games
