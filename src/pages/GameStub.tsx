import { useParams } from 'react-router-dom'
import { getGameById } from '../data/games'
import { useBack } from '../hooks/useBack'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
import GamesPageHeader from '../components/GamesPageHeader'
import '../styles/GamePageShell.css'
import './GameStub.css'

function GameStub() {
  const handleBack = useBack('/games')
  const { gameId } = useParams<{ gameId: string }>()
  const game = gameId ? getGameById(gameId) : null

  return (
    <div className="game-page game-stub-page game-page--enter">
      <div className="game-page__top">
        <HomeButton className="game-page__nav-btn" />
        <BackButton onClick={handleBack} className="game-page__nav-btn game-page__back" />
      </div>
      {game && (
        <GamesPageHeader
          title={game.title}
          tagline="Скоро в Game Night"
        />
      )}
      <div className="game-stub-page__content game-page__panel game-page__panel--glow-b">
        {game && (
          <span className="game-stub-page__emoji" aria-hidden>{game.emoji}</span>
        )}
        <p className="game-stub-page__msg">Игра в разработке</p>
        <p className="game-page__hint game-stub-page__hint">Скоро здесь появится новая игра. Следи за обновлениями!</p>
        <button type="button" className="game-page__cta game-stub-page__btn" onClick={handleBack}>
          Назад к играм
        </button>
      </div>
    </div>
  )
}

export default GameStub
