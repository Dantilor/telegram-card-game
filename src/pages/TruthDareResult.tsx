import { useNavigate } from 'react-router-dom'
import { useTruthDare } from '../games/truth-dare/TruthDareContext'
import { useBack } from '../hooks/useBack'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import './TruthDareResult.css'

function TruthDareResult() {
  const navigate = useNavigate()
  const { state, dispatch } = useTruthDare()

  const sortedByTruth = [...state.players].sort((a, b) => b.truthCounted - a.truthCounted)
  const sortedByDare = [...state.players].sort((a, b) => b.dareCounted - a.dareCounted)
  const sortedByCunning = [...state.players].sort(
    (a, b) => b.shame + b.notCounted - (a.shame + a.notCounted)
  )

  const mostHonest = sortedByTruth[0]
  const mostDaring = sortedByDare[0]
  const mostCunning = sortedByCunning[0]

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
        <button type="button" className="btn btn--ghost home-btn truth-dare-result__back" onClick={onBack}>
          ←
        </button>
        <HomeButton />
      </div>

      <h1 className="truth-dare-result__title">Игра окончена</h1>

      <div className="truth-dare-result__titles card">
        <h2 className="truth-dare-result__section-title">Титулы</h2>
        {mostHonest && mostHonest.truthCounted > 0 && (
          <p className="truth-dare-result__award">
            <span className="truth-dare-result__award-emoji" aria-hidden>💬</span>
            <span className="truth-dare-result__award-label">Самый честный</span>
            <span className="truth-dare-result__award-name">— {mostHonest.name}</span>
          </p>
        )}
        {mostCunning && mostCunning.shame + mostCunning.notCounted > 0 && (
          <p className="truth-dare-result__award">
            <span className="truth-dare-result__award-emoji" aria-hidden>🦊</span>
            <span className="truth-dare-result__award-label">Самый хитрый</span>
            <span className="truth-dare-result__award-name">— {mostCunning.name}</span>
          </p>
        )}
        {mostDaring && mostDaring.dareCounted > 0 && (
          <p className="truth-dare-result__award">
            <span className="truth-dare-result__award-emoji" aria-hidden>🔥</span>
            <span className="truth-dare-result__award-label">Не боится действовать</span>
            <span className="truth-dare-result__award-name">— {mostDaring.name}</span>
          </p>
        )}
      </div>

      <div className="truth-dare-result__table card">
        <h2 className="truth-dare-result__section-title">Итоги</h2>
        {state.players.map((p) => (
          <div key={p.id} className="truth-dare-result__row">
            <span className="truth-dare-result__name">{p.name}</span>
            <span className="truth-dare-result__stat">
              Засчитано: {p.truthCounted + p.dareCounted}
            </span>
            <span className="truth-dare-result__stat">Не засчитано: {p.notCounted}</span>
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
