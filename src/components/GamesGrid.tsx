import type { Game } from '../data/games'
import '../pages/Games.css'

type Props = {
  games: Game[]
  renderCard: (game: Game, index: number) => React.ReactNode
}

export default function GamesGrid({ games, renderCard }: Props) {
  return (
    <div className="games-grid">
      {games.map((game, i) => renderCard(game, i))}
    </div>
  )
}
