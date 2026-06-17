import { Link } from 'react-router-dom'
import type { Game } from '../data/games'
import { hapticSelection } from '../utils/haptics'
import { formatGameTags } from '../utils/gameTags'
import SmartImage from './SmartImage'
import '../pages/Games.css'

type Props = {
  game: Game
  isLocked: boolean
  to?: string
  badge?: string
  badgeVariant?: 'hit' | 'new'
  position?: 'top' | 'bottom'
}

export default function HeroGameCard({
  game,
  isLocked,
  to = '/card',
  badge = 'ХИТ',
  badgeVariant = 'hit',
  position = 'top',
}: Props) {
  const hasImage = 'image' in game && game.image
  const imageSrc = hasImage ? game.image! : ''
  const cardClass = `hero-game-card games-grid__card games-grid__card--ready games-grid__card--image${
    position === 'bottom' ? ' hero-game-card--bottom' : ' hero-game-card--top'
  }`

  const cardContent = (
    <>
      {hasImage ? (
        <div className="hero-game-card__media">
          <span
            className={`hero-game-card__badge${
              badgeVariant === 'new' ? ' hero-game-card__badge--new' : ''
            }`}
            aria-hidden
          >
            {badge}
          </span>
          {isLocked ? (
            <span className="games-card-badge games-card-badge--premium">PREMIUM</span>
          ) : null}
          <SmartImage
            src={imageSrc}
            alt=""
            className="hero-game-card__img"
            priority
            aspectRatio=""
            objectFit="cover"
          />
        </div>
      ) : (
        <span className="games-grid__emoji hero-game-card__emoji" aria-hidden>{game.emoji}</span>
      )}
      <div className="hero-game-card__content">
        <h2 className="hero-game-card__title">{game.title}</h2>
        <p className="hero-game-card__desc">{formatGameTags(game.description)}</p>
      </div>
    </>
  )

  if (isLocked) {
    return (
      <Link
        to={to}
        className={cardClass}
        onClick={() => hapticSelection()}
      >
        {cardContent}
      </Link>
    )
  }

  return (
    <Link
      to={to}
      className={cardClass}
      onClick={() => hapticSelection()}
    >
      {cardContent}
    </Link>
  )
}
