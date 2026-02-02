import { useNavigate, useLocation } from 'react-router-dom'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import './CityEconomyResult.css'

function CityEconomyResult() {
  const navigate = useNavigate()
  const location = useLocation()
  const { result, coins = 0, goal = 50 } = (location.state as { result?: 'win' | 'lose'; coins?: number; goal?: number }) ?? {}

  const handlePlayAgain = () => {
    hapticSelection()
    navigate('/city-economy')
  }

  const handleBackToGames = () => {
    haptic('light')
    navigate('/games')
  }

  const isWin = result === 'win'

  return (
    <div className="city-economy-result">
      <div className="city-economy-result__top">
        <HomeButton />
        <button
          type="button"
          className="btn btn--ghost city-economy-result__back"
          onClick={() => navigate('/city-economy')}
        >
          ← Назад
        </button>
      </div>

      <div className={`city-economy-result__card card ${isWin ? 'city-economy-result__card--win' : 'city-economy-result__card--lose'}`}>
        <h1 className="city-economy-result__title">
          {isWin ? 'Победа!' : 'Игра окончена'}
        </h1>
        <p className="city-economy-result__subtitle">
          {isWin
            ? `Вы набрали ${coins} монет и достигли цели ${goal}!`
            : `У вас ${coins} монет. Цель была ${goal}.`}
        </p>
      </div>

      <div className="city-economy-result__actions">
        <button
          type="button"
          className="btn btn--primary city-economy-result__btn"
          onClick={handlePlayAgain}
        >
          Сыграть ещё раз
        </button>
        <button
          type="button"
          className="btn btn--ghost city-economy-result__btn"
          onClick={handleBackToGames}
        >
          Вернуться к играм
        </button>
      </div>
    </div>
  )
}

export default CityEconomyResult
