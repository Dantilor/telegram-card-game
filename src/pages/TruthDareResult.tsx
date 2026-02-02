import { useNavigate } from 'react-router-dom'
import { useTruthDare } from '../games/truth-dare/TruthDareContext'
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

  const handleBack = () => {
    haptic('light')
    dispatch({ type: 'RESET' })
    navigate('/games')
  }

  return (
    <div className="truth-dare-result">
      <div className="truth-dare-result__top">
        <button type="button" className="btn btn--ghost truth-dare-result__back" onClick={handleBack}>
          ←
        </button>
        <HomeButton />
      </div>

      <h1 className="truth-dare-result__title">Игра окончена</h1>

      <div className="truth-dare-result__titles card">
        <h2 className="truth-dare-result__section-title">Титулы</h2>
        {bravest && (
          <p className="truth-dare-result__award">
            <span className="truth-dare-result__award-label">Самый смелый:</span> {bravest.name}
          </p>
        )}
        {honest && (
          <p className="truth-dare-result__award">
            <span className="truth-dare-result__award-label">Самый честный:</span> {honest.name}
          </p>
        )}
        {shameKing && shameKing.shame > 0 && (
          <p className="truth-dare-result__award">
            <span className="truth-dare-result__award-label">Король стыда:</span> {shameKing.name}
          </p>
        )}
      </div>

      <div className="truth-dare-result__table card">
        <h2 className="truth-dare-result__section-title">Итоги</h2>
        {state.players.map((p) => (
          <div key={p.id} className="truth-dare-result__row">
            <span className="truth-dare-result__name">{p.name}</span>
            <span>Courage: {p.courage}</span>
            <span>Respect: {p.respect}</span>
            <span>Shame: {p.shame}</span>
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
        <button
          type="button"
          className="btn btn--ghost truth-dare-result__btn"
          onClick={() => {
            haptic('light')
            dispatch({ type: 'RESET' })
            navigate('/truth-dare')
          }}
        >
          Сменить тему
        </button>
      </div>
    </div>
  )
}

export default TruthDareResult
