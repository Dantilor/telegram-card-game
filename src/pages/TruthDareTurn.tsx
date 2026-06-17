import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTruthDare } from '../games/truth-dare/TruthDareContext'
import { useBack } from '../hooks/useBack'
import { hapticSelection } from '../utils/haptics'
import { trackEvent } from '../lib/analytics'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
import './TruthDareTurn.css'

function TruthDareTurn() {
  const navigate = useNavigate()
  const { state, dispatch } = useTruthDare()

  const player = state.players[state.currentPlayerIndex]
  const shameActive = player && player.shame >= 3

  useEffect(() => {
    trackEvent('start_game', { gameId: 'truth-dare' })
  }, [])

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

  const handleBack = useBack('/truth-dare')

  if (!player) {
    navigate('/truth-dare')
    return null
  }

  return (
    <div className="game-page truth-dare-turn">
      <div className="game-page__top">
        <HomeButton className="game-page__nav-btn" />
        <BackButton onClick={handleBack} className="game-page__nav-btn game-page__back" />
      </div>

      <span className="game-page__progress">
        Ход {state.stepCount + 1} / {state.totalStepsTarget}
      </span>

      <div className="truth-dare-turn__player game-page__panel game-page__panel--glow-a">
        <h2 className="truth-dare-turn__name">{player.name}</h2>
        <div className="truth-dare-turn__stats">
          <span>Засчитано: {player.truthCounted + player.dareCounted}</span>
          <span>Не засчитано: {player.notCounted}</span>
        </div>
      </div>

      {shameActive ? (
        <div className="truth-dare-turn__shame">
          <p className="truth-dare-turn__shame-text">Нельзя отказаться!</p>
          <div className="truth-dare-turn__choices">
            <button
              type="button"
              className="game-page__cta truth-dare-turn__choice--truth"
              onClick={() => handleChoice('truth')}
            >
              Правда (уровень 4)
            </button>
            <button
              type="button"
              className="game-page__cta truth-dare-turn__choice--dare"
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
            className="game-page__cta truth-dare-turn__choice--truth"
            onClick={() => handleChoice('truth')}
          >
            Правда
          </button>
          <button
            type="button"
            className="game-page__cta truth-dare-turn__choice--dare"
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
