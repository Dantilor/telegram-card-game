import { Link } from 'react-router-dom'
import type { Game } from '../data/games'
import { hapticSelection } from '../utils/haptics'
import SmartImage from './SmartImage'
import '../pages/Games.css'

type Props = {
  game: Game
  isLocked: boolean
  onPremiumOpen: () => void
  to?: string
  badge?: string
  badgeVariant?: 'hit' | 'new'
  position?: 'top' | 'bottom'
}

export default function HeroGameCard({
  game,
  isLocked,
  onPremiumOpen,
  to = '/card',
  badge = '🔥 HIT',
  badgeVariant = 'hit',
  position = 'top',
}: Props) {
  const hasImage = 'image' in game && game.image
  const imageSrc = hasImage ? game.image! : ''
  const cardClass = `hero-game-card games-grid__card games-grid__card--ready games-grid__card--image${
    position === 'bottom' ? ' hero-game-card--bottom' : ''
  }`

  const cardContent = (
    <>
      <span
        className={`hero-game-card__badge${
          badgeVariant === 'new' ? ' hero-game-card__badge--new' : ''
        }`}
        aria-hidden
      >
        {badge}
      </span>
      {hasImage ? (
        <div className="hero-game-card__media">
          <SmartImage
            src={imageSrc}
            alt=""
            className="hero-game-card__img"
            priority
          />
        </div>
      ) : (
        <span className="games-grid__emoji hero-game-card__emoji" aria-hidden>{game.emoji}</span>
      )}
      <div className="hero-game-card__content">
        <h2 className="hero-game-card__title">{game.title}</h2>
        <p className="hero-game-card__desc">{game.description}</p>
      </div>
    </>
  )

  if (isLocked) {
    return (
      <button
        type="button"
        className={cardClass}
        onClick={() => {
          hapticSelection()
          onPremiumOpen()
        }}
      >
        {cardContent}
        <span className="badge badge--premium hero-game-card__bottom-badge">Premium</span>
      </button>
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
