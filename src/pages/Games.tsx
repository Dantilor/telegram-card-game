import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GAMES } from '../data/games'
import { useBack } from '../hooks/useBack'
import { requestFullscreenOnUserGesture } from '../lib/telegramTheme'
import { usePremium } from '../contexts/PremiumContext'
import { isGameLocked } from '../utils/access'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
import PremiumOverlay from '../components/PremiumOverlay'
import HeroGameCard from '../components/HeroGameCard'
import GamesGrid from '../components/GamesGrid'
import SmartImage from '../components/SmartImage'
import './Games.css'

const HERO_GAME_ID = 'card'
const BOTTOM_HERO_GAME_ID = 'who-is-who'

const READY_GAME_ROUTES: Record<string, string> = {
  alias: '/alias',
  activity: '/activity',
  mafia: '/mafia',
  quiz: '/quiz',
  'truth-dare': '/truth-dare',
  sabotage: '/sabotage',
}

function Games() {
  const navigate = useNavigate()
  const handleBack = useBack('/')
  const { isPremium } = usePremium()
  const [premiumOverlayOpen, setPremiumOverlayOpen] = useState(false)

  // Предзагрузка чанков игр при открытии списка — чтобы при нажатии не было подвисания и сетки
  useEffect(() => {
    import('./AliasLayout')
    import('./ActivityLayout')
    import('./MafiaLayout')
    import('./SabotageLayout')
    import('./QuizLayout')
    import('./TruthDareLayout')
    import('./WhoIsWhoLayout')
  }, [])

  const heroGame = GAMES.find((g) => g.id === HERO_GAME_ID)
  const bottomHeroGame = GAMES.find((g) => g.id === BOTTOM_HERO_GAME_ID)
  const otherGames = GAMES.filter(
    (g) => g.id !== HERO_GAME_ID && g.id !== BOTTOM_HERO_GAME_ID
  )

  const renderGameCard = (game: (typeof GAMES)[0], i: number) => {
    const isReady = game.status === 'ready'
    const isLocked = isReady && isGameLocked(game.id, isPremium)
    const hasImage = 'image' in game && game.image
    const cardClass = `games-grid__card card ${isReady ? 'games-grid__card--ready tile--active' : 'games-grid__card--stub'}${hasImage ? ' games-grid__card--image' : ''}`
    const cardContent = (
      <>
        {hasImage ? (
          <div className="games-grid__card-image-wrap">
            <SmartImage src={game.image!} alt="" className="games-grid__card-img" priority={i < 6} />
          </div>
        ) : (
          <span className="games-grid__emoji" aria-hidden>{game.emoji}</span>
        )}
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
          onClick={() => {
            hapticSelection()
            requestFullscreenOnUserGesture()
          }}
        >
          {cardContent}
        </Link>
      )
    }

    const route = READY_GAME_ROUTES[game.id]
    if (isReady && route) {
      return (
        <Link key={game.id} to={route} className={cardClass} style={{ animationDelay: `${i * 0.05}s` }} onClick={() => hapticSelection()}>
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
        <BackButton onClick={handleBack} className="games-page__back" />
      </div>
      <header className="games-page__header">
        <h1 className="games-page__title">GameNight Host</h1>
        <p className="games-page__tagline">Выбери игру</p>
      </header>
      {heroGame && (
        <HeroGameCard
          game={heroGame}
          isLocked={isGameLocked(heroGame.id, isPremium)}
          onPremiumOpen={() => setPremiumOverlayOpen(true)}
        />
      )}
      <GamesGrid
        games={otherGames}
        renderCard={renderGameCard}
      />
      {bottomHeroGame && (
        <HeroGameCard
          game={bottomHeroGame}
          isLocked={isGameLocked(bottomHeroGame.id, isPremium)}
          onPremiumOpen={() => setPremiumOverlayOpen(true)}
          to="/who-is-who"
          badge="NEW"
          badgeVariant="new"
          position="bottom"
        />
      )}
      <PremiumOverlay isOpen={premiumOverlayOpen} onClose={() => setPremiumOverlayOpen(false)} />
    </div>
  )
}

export default Games
