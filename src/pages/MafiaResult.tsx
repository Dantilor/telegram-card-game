import { useNavigate } from 'react-router-dom'
import { useMafiaGame } from '../games/mafia/MafiaGameContext'
import { ROLE_LABELS } from '../games/mafia/types'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import './MafiaResult.css'

function MafiaResult() {
  const navigate = useNavigate()
  const { state, dispatch } = useMafiaGame()
  const isPeacefulWin = state.winner === 'peaceful'

  const handlePlayAgain = () => {
    hapticSelection()
    dispatch({ type: 'RESET' })
    navigate('/mafia')
  }

  const handleBackToGames = () => {
    haptic('light')
    dispatch({ type: 'RESET' })
    navigate('/games')
  }

  const roleEmoji: Record<string, string> = {
    civilian: '👤',
    mafia: '🌙',
    doctor: '💊',
    sheriff: '⭐',
  }

  return (
    <div className="mafia-result">
      <div className="mafia-result__top">
        <HomeButton />
        <button
          type="button"
          className="btn btn--ghost mafia-result__back"
          onClick={() => navigate('/mafia')}
        >
          ← Назад
        </button>
      </div>

      <div className={`mafia-result__card card ${isPeacefulWin ? 'mafia-result__card--win' : 'mafia-result__card--lose'}`}>
        <h1 className="mafia-result__title">
          {isPeacefulWin ? 'Победа мирных!' : 'Победа мафии!'}
        </h1>
      </div>

      <div className="mafia-result__roles card">
        <h2 className="mafia-result__roles-title">Кто кем был</h2>
        <ul className="mafia-result__roles-list">
          {state.players.map((p) => (
            <li key={p.id} className="mafia-result__roles-item">
              <span className="mafia-result__roles-emoji">{roleEmoji[p.role]}</span>
              <span className="mafia-result__roles-name">{p.name}</span>
              <span className="mafia-result__roles-role">{ROLE_LABELS[p.role]}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mafia-result__actions">
        <button
          type="button"
          className="btn btn--primary mafia-result__btn"
          onClick={handlePlayAgain}
        >
          Сыграть ещё раз
        </button>
        <button
          type="button"
          className="btn btn--ghost mafia-result__btn"
          onClick={handleBackToGames}
        >
          В меню игр
        </button>
      </div>
    </div>
  )
}

export default MafiaResult
