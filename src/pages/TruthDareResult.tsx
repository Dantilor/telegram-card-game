import { useNavigate } from 'react-router-dom'
import { useTruthDare } from '../games/truth-dare/TruthDareContext'
import { useBack } from '../hooks/useBack'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import './TruthDareResult.css'

function TruthDareResult() {
  const navigate = useNavigate()
  const { state, dispatch } = useTruthDare()

  const sortedByCourage = [...state.players].sort((a, b) => b.courage - a.courage)
  const sortedByRespect = [...state.players].sort((a, b) => b.respect - a.respect)
  const sortedByShame = [...state.players].sort((a, b) => b.shame - a.shame)

  const bravest = sortedByCourage[0]
  const honest = sortedByRespect[0]
  const shameKing = sortedByShame[0]

  const handleContinue = () => {
    hapticSelection()
    dispatch({ type: 'CONTINUE_10' })
    navigate('/truth-dare/turn')
  }

  const handleNewGame = () => {
    hapticSelection()
    dispatch({ type: 'RESET' })
    navigate('/truth-dare')
  }

  const handleBack = useBack('/games')
  const onBack = () => {
    dispatch({ type: 'RESET' })
    handleBack()
  }

  return (
    <div className="truth-dare-result">
      <div className="truth-dare-result__top">
        <button type="button" className="btn btn--ghost truth-dare-result__back" onClick={onBack}>
          ←
        </button>
        <HomeButton />
      </div>

      <h1 className="truth-dare-result__title">Игра окончена</h1>

      <div className="truth-dare-result__titles card">
        <h2 className="truth-dare-result__section-title">Титулы</h2>
        {bravest && bravest.courage > 0 && (
          <p className="truth-dare-result__award">
            <span className="truth-dare-result__award-emoji">🔥</span>
            <span className="truth-dare-result__award-label">Самый безбашенный</span>
            <span className="truth-dare-result__award-name">— {bravest.name}</span>
          </p>
        )}
        {honest && honest.respect > 0 && (
          <p className="truth-dare-result__award">
            <span className="truth-dare-result__award-emoji">👑</span>
            <span className="truth-dare-result__award-label">Любимец публики</span>
            <span className="truth-dare-result__award-name">— {honest.name}</span>
          </p>
        )}
        {shameKing && shameKing.shame > 0 && (
          <p className="truth-dare-result__award">
            <span className="truth-dare-result__award-emoji">😈</span>
            <span className="truth-dare-result__award-label">Провокатор</span>
            <span className="truth-dare-result__award-name">— {shameKing.name}</span>
          </p>
        )}
      </div>

      <div className="truth-dare-result__table card">
        <h2 className="truth-dare-result__section-title">Итоги</h2>
        {state.players.map((p) => (
          <div key={p.id} className="truth-dare-result__row">
            <span className="truth-dare-result__name">{p.name}</span>
            <span className="truth-dare-result__stat">Смелость: {p.courage}</span>
            <span className="truth-dare-result__stat">Репутация: {p.respect}</span>
            <span className="truth-dare-result__stat">Стыд: {p.shame}</span>
          </div>
        ))}
      </div>

      <div className="truth-dare-result__actions">
        <button
          type="button"
          className="btn btn--primary truth-dare-result__btn"
          onClick={handleContinue}
        >
          Ещё 10 ходов
        </button>
        <button
          type="button"
          className="btn btn--secondary truth-dare-result__btn"
          onClick={handleNewGame}
        >
          Новая игра
        </button>
      </div>
    </div>
  )
}

export default TruthDareResult
