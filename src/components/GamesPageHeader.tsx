import { useTheme } from '../hooks/useTheme'
import './GamesPageHeader.css'

type GamesPageHeaderProps = {
  title?: string
  tagline?: string
}

export default function GamesPageHeader({
  title = 'GameNight Host',
  tagline = 'Выбери игру',
}: GamesPageHeaderProps) {
  const [theme] = useTheme()

  return (
    <header className={`games-page-header games-page-header--${theme}`}>
      <h1 className="games-page-header__title">{title}</h1>
      <p className="games-page-header__tagline">
        <span className="games-page-header__sparkle" aria-hidden>✦</span>
        {tagline}
        <span className="games-page-header__sparkle" aria-hidden>✦</span>
      </p>
    </header>
  )
}
