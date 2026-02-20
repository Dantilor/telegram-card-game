import { Link } from 'react-router-dom'
import type { Game } from '../data/games'
import { hapticSelection } from '../utils/haptics'
import '../pages/Games.css'

type Props = {
  game: Game
  isLocked: boolean
  onPremiumOpen: () => void
}

export default function HeroGameCard({ game, isLocked, onPremiumOpen }: Props) {
  const hasImage = 'image' in game && game.image
  const imageSrc = hasImage ? game.image! : ''

  const cardContent = (
    <>
      <span className="hero-game-card__badge" aria-hidden>🔥 HIT</span>
      {hasImage ? (
        <div className="hero-game-card__media">
          <img
            className="hero-game-card__img"
            src={imageSrc}
            alt=""
            loading="eager"
            decoding="async"
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
        className="hero-game-card games-grid__card games-grid__card--ready games-grid__card--image"
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
      to="/card"
      className="hero-game-card games-grid__card games-grid__card--ready games-grid__card--image"
      onClick={() => hapticSelection()}
    >
      {cardContent}
    </Link>
  )
}
