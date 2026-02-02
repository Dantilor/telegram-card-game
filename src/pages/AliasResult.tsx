import { useNavigate, useLocation } from 'react-router-dom'
import { useAliasState } from '../games/alias/useAliasState'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import './AliasResult.css'

type ResultState = { guessed: number; skipped: number } | null

function AliasResult() {
  const navigate = useNavigate()
  const location = useLocation()
  const [state] = useAliasState()
  const result = (location.state as ResultState) ?? { guessed: 0, skipped: 0 }

  const handleNextRound = () => {
    hapticSelection()
    navigate('/alias/play')
  }

  const handleChangeCategory = () => {
    haptic('light')
    navigate('/alias')
  }

  return (
    <div className="alias-result">
      <div className="alias-result__top">
        <HomeButton />
        <button
          type="button"
          className="btn btn--ghost alias-result__back"
          onClick={() => navigate('/alias')}
        >
          ← Назад
        </button>
      </div>
      <header className="alias-result__header">
        <h1 className="alias-result__title">Итоги раунда</h1>
      </header>
      <div className="alias-result__stats card">
        <div className="alias-result__stat">
          <span className="alias-result__stat-value">{result.guessed}</span>
          <span className="alias-result__stat-label">Угадано</span>
        </div>
        <div className="alias-result__stat">
          <span className="alias-result__stat-value">{result.skipped}</span>
          <span className="alias-result__stat-label">Пропущено</span>
        </div>
      </div>
      {state.mode === 'team' && (
        <div className="alias-result__scores card">
          <h2 className="alias-result__scores-title">Счёт</h2>
          <p className="alias-result__scores-text">
            A: {state.scores.teamA} — B: {state.scores.teamB}
          </p>
        </div>
      )}
      <div className="alias-result__actions">
        <button
          type="button"
          className="btn btn--primary alias-result__btn"
          onClick={handleNextRound}
        >
          Следующий раунд
        </button>
        <button
          type="button"
          className="btn btn--ghost alias-result__btn"
          onClick={handleChangeCategory}
        >
          Сменить категорию
        </button>
      </div>
    </div>
  )
}

export default AliasResult
