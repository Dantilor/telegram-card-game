import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GAMES } from '../data/games'
import { useBack } from '../hooks/useBack'
import { usePremium } from '../contexts/PremiumContext'
import { isGameLocked } from '../utils/access'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import PremiumOverlay from '../components/PremiumOverlay'
import './Games.css'

function Games() {
  const navigate = useNavigate()
  const handleBack = useBack('/')
  const { isPremium } = usePremium()
  const [premiumOverlayOpen, setPremiumOverlayOpen] = useState(false)

  const renderGameCard = (game: (typeof GAMES)[0], i: number) => {
    const isReady = game.status === 'ready'
    const isLocked = isReady && isGameLocked(game.id, isPremium)
    const cardClass = `games-grid__card card ${isReady ? 'games-grid__card--ready tile--active' : 'games-grid__card--stub'}`
    const cardContent = (
      <>
        <span className="games-grid__emoji" aria-hidden>{game.emoji}</span>
        <h2 className="games-grid__title">{game.title}</h2>
        <p className="games-grid__desc">{game.description}</p>
      </>
    )

    if (isLocked) {
      return (
        <button
          key={game.id}
          type="button"
          className={cardClass}
          style={{ animationDelay: `${i * 0.05}s` }}
          onClick={() => {
            hapticSelection()
            setPremiumOverlayOpen(true)
          }}
        >
          {cardContent}
          <span className="badge badge--premium">Premium</span>
        </button>
      )
    }

    if (isReady && game.id === 'card') {
      return (
        <Link
          key={game.id}
          to="/card"
          className={cardClass}
          style={{ animationDelay: `${i * 0.05}s` }}
          onClick={() => hapticSelection()}
        >
          {cardContent}
        </Link>
      )
    }
    if (isReady && game.id === 'alias') {
      return (
        <Link key={game.id} to="/alias" className={cardClass} style={{ animationDelay: `${i * 0.05}s` }} onClick={() => hapticSelection()}>
          {cardContent}
        </Link>
      )
    }
    if (isReady && game.id === 'activity') {
      return (
        <Link key={game.id} to="/activity" className={cardClass} style={{ animationDelay: `${i * 0.05}s` }} onClick={() => hapticSelection()}>
          {cardContent}
        </Link>
      )
    }
    if (isReady && game.id === 'mafia') {
      return (
        <Link key={game.id} to="/mafia" className={cardClass} style={{ animationDelay: `${i * 0.05}s` }} onClick={() => hapticSelection()}>
          {cardContent}
        </Link>
      )
    }
    if (isReady && game.id === 'quiz') {
      return (
        <Link key={game.id} to="/quiz" className={cardClass} style={{ animationDelay: `${i * 0.05}s` }} onClick={() => hapticSelection()}>
          {cardContent}
        </Link>
      )
    }
    if (isReady && game.id === 'truth-dare') {
      return (
        <Link key={game.id} to="/truth-dare" className={cardClass} style={{ animationDelay: `${i * 0.05}s` }} onClick={() => hapticSelection()}>
          {cardContent}
        </Link>
      )
    }
    if (isReady && game.id === 'sabotage') {
      return (
        <Link key={game.id} to="/sabotage" className={cardClass} style={{ animationDelay: `${i * 0.05}s` }} onClick={() => hapticSelection()}>
          {cardContent}
        </Link>
      )
    }
    return (
      <button
        key={game.id}
        type="button"
        className={cardClass}
        style={{ animationDelay: `${i * 0.05}s` }}
        onClick={() => {
          hapticSelection()
          navigate(`/game/${game.id}`)
        }}
      >
        {cardContent}
        <span className="badge badge--soon">SOON</span>
      </button>
    )
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
        {GAMES.map((game, i) => renderGameCard(game, i))}
      </div>
      <PremiumOverlay isOpen={premiumOverlayOpen} onClose={() => setPremiumOverlayOpen(false)} />
    </div>
  )
}

export default Games
