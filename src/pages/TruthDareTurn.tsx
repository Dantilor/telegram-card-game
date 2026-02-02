import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTruthDare } from '../games/truth-dare/TruthDareContext'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import './TruthDareTurn.css'

function TruthDareTurn() {
  const navigate = useNavigate()
  const { state, dispatch } = useTruthDare()

  const player = state.players[state.currentPlayerIndex]
  const shameActive = player && player.shame >= 3

  useEffect(() => {
    if (state.phase === 'result') navigate('/truth-dare/result')
  }, [state.phase, navigate])

  const handleChoice = (choice: 'truth' | 'dare') => {
    hapticSelection()
    if (shameActive) {
      dispatch({ type: 'SHAME_CHOICE', choice })
    } else {
      dispatch({ type: 'CHOICE', choice })
    }
    navigate('/truth-dare/card')
  }

  const handleBack = () => {
    haptic('light')
    navigate('/truth-dare')
  }

  if (!player) {
    navigate('/truth-dare')
    return null
  }

  return (
    <div className="truth-dare-turn">
      <div className="truth-dare-turn__top">
        <button type="button" className="btn btn--ghost truth-dare-turn__back" onClick={handleBack}>
          ←
        </button>
        <HomeButton />
      </div>

      <div className="truth-dare-turn__meta">
        <span>Ход {state.stepCount + 1} / {state.totalStepsTarget}</span>
      </div>

      <div className="truth-dare-turn__player card">
        <h2 className="truth-dare-turn__name">{player.name}</h2>
        <div className="truth-dare-turn__stats">
          <span>Смелость: {player.courage}</span>
          <span>Репутация: {player.respect}</span>
          <span>Стыд: {player.shame}</span>
        </div>
      </div>

      {shameActive ? (
        <div className="truth-dare-turn__shame">
          <p className="truth-dare-turn__shame-text">Карта стыда — нельзя отказаться!</p>
          <div className="truth-dare-turn__choices">
            <button
              type="button"
              className="btn truth-dare-turn__choice-btn"
              onClick={() => handleChoice('truth')}
            >
              Правда (уровень 4)
            </button>
            <button
              type="button"
              className="btn truth-dare-turn__choice-btn"
              onClick={() => handleChoice('dare')}
            >
              Действие (уровень 3)
            </button>
          </div>
        </div>
      ) : (
        <div className="truth-dare-turn__choices">
          <button
            type="button"
            className="btn truth-dare-turn__choice-btn truth-dare-turn__choice--truth"
            onClick={() => handleChoice('truth')}
          >
            Правда
          </button>
          <button
            type="button"
            className="btn truth-dare-turn__choice-btn truth-dare-turn__choice--dare"
            onClick={() => handleChoice('dare')}
          >
            Действие
          </button>
        </div>
      )}
    </div>
  )
}

export default TruthDareTurn
