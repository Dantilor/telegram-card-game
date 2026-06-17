import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GAMES } from '../data/games'
import { useBack } from '../hooks/useBack'
import { requestFullscreenOnUserGesture } from '../lib/telegramTheme'
import { usePremium } from '../contexts/PremiumContext'
import { isGameLocked } from '../utils/access'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
import HeroGameCard from '../components/HeroGameCard'
import GamesGrid from '../components/GamesGrid'
import GamesPageHeader from '../components/GamesPageHeader'
import CatalogTabs from '../components/CatalogTabs'
import SmartImage from '../components/SmartImage'
import { formatGameTags } from '../utils/gameTags'
import './Games.css'

const HERO_GAME_ID = 'card'
const BOTTOM_HERO_GAME_ID = 'russia-travel'
const FEATURED_HERO_GAME_ID = 'who-is-who'

const GRID_EXCLUDED_GAME_IDS = new Set([HERO_GAME_ID, BOTTOM_HERO_GAME_ID, FEATURED_HERO_GAME_ID])

const READY_GAME_ROUTES: Record<string, string> = {
  alias: '/alias',
  activity: '/activity',
  mafia: '/mafia',
  quiz: '/quiz',
  'truth-dare': '/truth-dare',
  sabotage: '/sabotage',
  'who-is-who': '/who-is-who',
  'phrase-translator': '/phrase-translator',
  'freebie-trash': '/freebie-trash',
  'russia-travel': '/russia-travel',
}

function Games() {
  const navigate = useNavigate()
  const handleBack = useBack('/')
  const { isPremium } = usePremium()

  useEffect(() => {
    import('./AliasLayout')
    import('./ActivityLayout')
    import('./MafiaLayout')
    import('./SabotageLayout')
    import('./QuizLayout')
    import('./TruthDareLayout')
    import('./WhoIsWhoLayout')
    import('./PhraseTranslator')
    import('./FreebieTrashLayout')
    import('./RussiaTravel')
  }, [])

  const heroGame = GAMES.find((g) => g.id === HERO_GAME_ID)
  const featuredHeroGame = GAMES.find((g) => g.id === FEATURED_HERO_GAME_ID)
  const bottomHeroGame = GAMES.find((g) => g.id === BOTTOM_HERO_GAME_ID)
  const otherGames = GAMES.filter((g) => !GRID_EXCLUDED_GAME_IDS.has(g.id))

  const getGameRoute = (game: (typeof GAMES)[0]) => {
    if (game.id === 'card') return '/card'
    return READY_GAME_ROUTES[game.id] ?? `/game/${game.id}`
  }

  const renderGameCard = (game: (typeof GAMES)[0], i: number) => {
    const isReady = game.status === 'ready'
    const isLocked = isReady && isGameLocked(game.id, isPremium)
    const route = getGameRoute(game)
    const hasImage = 'image' in game && game.image
    const cardClass = `games-grid__card card ${isReady ? 'games-grid__card--ready tile--active' : 'games-grid__card--stub'}${hasImage ? ' games-grid__card--image' : ''} games-grid__card--glow-${i % 2 === 0 ? 'a' : 'b'}`
    const cardContent = (
      <>
        {hasImage ? (
          <div className="games-grid__card-image-wrap">
            <SmartImage
              src={game.image!}
              alt=""
              className="games-grid__card-img"
              priority={i < 6}
              aspectRatio=""
              objectFit="cover"
            />
            {game.catalogBadge === 'new' && !isLocked ? (
              <span className="games-card-badge games-card-badge--new">NEW</span>
            ) : null}
            {isLocked ? (
              <span className="games-card-badge games-card-badge--premium">PREMIUM</span>
            ) : null}
          </div>
        ) : (
          <span className="games-grid__emoji" aria-hidden>{game.emoji}</span>
        )}
        <div className="games-grid__card-body">
          <h2 className="games-grid__title">{game.title}</h2>
          <p className="games-grid__desc">{formatGameTags(game.description)}</p>
        </div>
      </>
    )

    if (isReady) {
      return (
        <Link
          key={game.id}
          to={route}
          className={cardClass}
          style={{ animationDelay: `${i * 0.05}s` }}
          onClick={() => {
            hapticSelection()
            if (game.id === 'card') requestFullscreenOnUserGesture()
          }}
        >
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
        <HomeButton className="games-page__nav-btn" />
        <BackButton onClick={handleBack} className="games-page__nav-btn games-page__back" />
      </div>
      <GamesPageHeader tagline="что запускаем сегодня?" />
      <CatalogTabs active="games" />
      {heroGame && (
        <HeroGameCard
          game={heroGame}
          isLocked={isGameLocked(heroGame.id, isPremium)}
        />
      )}
      <GamesGrid games={otherGames} renderCard={renderGameCard} />
      {featuredHeroGame && (
        <HeroGameCard
          game={featuredHeroGame}
          isLocked={isGameLocked(featuredHeroGame.id, isPremium)}
          to="/who-is-who"
          badge="NEW"
          badgeVariant="new"
          position="bottom"
        />
      )}
      {bottomHeroGame && (
        <HeroGameCard
          game={bottomHeroGame}
          isLocked={isGameLocked(bottomHeroGame.id, isPremium)}
          to="/russia-travel"
          badge="NEW"
          badgeVariant="new"
          position="bottom"
        />
      )}
    </div>
  )
}

export default Games
