import { useParams } from 'react-router-dom'
import { getGameById } from '../data/games'
import { useBack } from '../hooks/useBack'
import HomeButton from '../components/HomeButton'
import './GameStub.css'

function GameStub() {
  const handleBack = useBack('/games')
  const { gameId } = useParams<{ gameId: string }>()
  const game = gameId ? getGameById(gameId) : null

  return (
    <div className="game-stub-page">
      <div className="game-stub-page__top">
        <HomeButton />
        <button type="button" className="btn btn--ghost home-btn game-stub-page__back" onClick={handleBack}>
          ← Назад
        </button>
      </div>
      <div className="game-stub-page__content card">
        {game && (
          <>
            <span className="game-stub-page__emoji" aria-hidden>{game.emoji}</span>
            <h1 className="game-stub-page__title">{game.title}</h1>
          </>
        )}
        <p className="game-stub-page__msg">Игра в разработке</p>
        <p className="game-stub-page__hint">Скоро здесь появится новая игра. Следи за обновлениями!</p>
        <button type="button" className="btn btn--primary game-stub-page__btn" onClick={handleBack}>
          Назад к играм
        </button>
      </div>
    </div>
  )
}

export default GameStub
