import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { hapticImpact } from '../utils/haptics'
import { IconCardDeck, IconMafia, IconSabotage } from './PopularGamesIcons'
import PopularGamesSkeleton from './PopularGamesSkeleton'
import './PopularGames.css'

export type PopularGame = {
  id: string
  title: string
  to: string
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
}

const POPULAR_GAMES: PopularGame[] = [
  { id: 'card', title: 'Карточная игра', to: '/card', Icon: IconCardDeck },
  { id: 'mafia', title: 'Мафия (мини)', to: '/mafia', Icon: IconMafia },
  { id: 'sabotage', title: 'Саботаж', to: '/sabotage', Icon: IconSabotage },
]

function PopularGames() {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const t = requestAnimationFrame(() => {
      setTimeout(() => setIsReady(true), 50)
    })
    return () => cancelAnimationFrame(t)
  }, [])

  if (!isReady) {
    return <PopularGamesSkeleton />
  }

  return (
    <section className="popular-games" aria-labelledby="popular-games-title">
      <h2 id="popular-games-title" className="popular-games__title">
        Самые популярные
      </h2>
      <p className="popular-games__subtitle">Выбирают чаще всего</p>
      <div className="popular-games__scroll">
        <div className="popular-games__track">
          {POPULAR_GAMES.map((game) => {
            const Icon = game.Icon
            return (
              <Link
                key={game.id}
                to={game.to}
                className="popular-games__card"
                onClick={() => hapticImpact('light')}
              >
                <span className="popular-games__icon">
                  <Icon />
                </span>
                <span className="popular-games__name">{game.title}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default PopularGames
