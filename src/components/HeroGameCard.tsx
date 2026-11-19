import { Link } from 'react-router-dom'
import type { CSSProperties } from 'react'
import type { Game } from '../data/games'
import { hapticSelection } from '../utils/haptics'
import { formatGameTags } from '../utils/gameTags'
import SmartImage from './SmartImage'
import ResponsiveArtwork, { type ResponsiveArtworkSource } from './ResponsiveArtwork'
import '../pages/Games.css'

type Props = {
  game: Game
  isLocked: boolean
  to?: string
  badge?: string
  badgeVariant?: 'hit' | 'new'
  position?: 'top' | 'bottom'
  imageFit?: 'cover' | 'contain'
  artwork?: ResponsiveArtworkSource
}

export default function HeroGameCard({
  game,
  isLocked,
  to = '/card',
  badge = 'ХИТ',
  badgeVariant = 'hit',
  position = 'top',
  imageFit = 'contain',
  artwork,
}: Props) {
  const hasImage = Boolean(artwork) || ('image' in game && game.image)
  const imageSrc = !artwork && 'image' in game && game.image ? game.image! : ''
  const cardClass = `hero-game-card games-grid__card games-grid__card--ready games-grid__card--image${
    position === 'bottom' ? ' hero-game-card--bottom' : ' hero-game-card--top'
  }${artwork ? ' hero-game-card--responsive' : ''}`

  const mediaStyle = artwork
    ? ({
        '--gnh-aspect-desktop': `${artwork.desktop.width} / ${artwork.desktop.height}`,
        '--gnh-aspect-mobile': `${artwork.mobile.width} / ${artwork.mobile.height}`,
      } as CSSProperties)
    : undefined

  const cardContent = (
    <>
      {hasImage ? (
        <div className="hero-game-card__media" style={mediaStyle}>
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
          {artwork ? (
            <ResponsiveArtwork artwork={artwork} alt="" priority className="hero-game-card__responsive-art" />
          ) : (
            <SmartImage
              src={imageSrc}
              alt=""
              className="hero-game-card__img"
              priority
              aspectRatio=""
              objectFit={imageFit}
            />
          )}
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
