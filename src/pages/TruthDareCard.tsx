import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTruthDare } from '../games/truth-dare/TruthDareContext'
import { useBack } from '../hooks/useBack'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import './TruthDareCard.css'

function TruthDareCard() {
  const navigate = useNavigate()
  const { state, dispatch } = useTruthDare()

  const player = state.players[state.currentPlayerIndex]
  const card = state.currentCard

  useEffect(() => {
    if (state.phase === 'vote') navigate('/truth-dare/vote')
    if (state.phase === 'choice') navigate('/truth-dare/turn')
    if (state.phase === 'result') navigate('/truth-dare/result')
  }, [state.phase, navigate])

  const handleCompleted = () => {
    hapticSelection()
    dispatch({ type: 'COMPLETED' })
  }

  const handleRefused = () => {
    if (state.forcedNoRefuse) return
    hapticSelection()
    dispatch({ type: 'REFUSED' })
    navigate('/truth-dare/turn')
  }

  const handleReroll = () => {
    if (!player || player.tokens.rerollSameLevel <= 0) return
    hapticSelection()
    dispatch({ type: 'REROLL' })
  }

  const handleBack = useBack('/truth-dare/turn')

  if (!card || !player) {
    navigate('/truth-dare/turn')
    return null
  }

  return (
    <div className="truth-dare-card">
      <div className="truth-dare-card__top">
        <button type="button" className="btn btn--ghost truth-dare-card__back" onClick={handleBack}>
          ←
        </button>
        <HomeButton />
      </div>

      <div className="truth-dare-card__level">Уровень {card.level}</div>

      <div className="truth-dare-card__card card">
        <p className="truth-dare-card__type">{card.type === 'truth' ? 'Правда' : 'Действие'}</p>
        <p className="truth-dare-card__text">{card.text}</p>
      </div>

      <div className="truth-dare-card__actions">
        <button
          type="button"
          className="btn btn--primary truth-dare-card__btn"
          onClick={handleCompleted}
        >
          Выполнено
        </button>
        {!state.forcedNoRefuse && (
          <button
            type="button"
            className="btn truth-dare-card__btn truth-dare-card__btn--refuse"
            onClick={handleRefused}
          >
            Отказ
          </button>
        )}
      </div>

      <div className="truth-dare-card__tokens">
        {player.tokens.rerollSameLevel > 0 && (
          <div className="truth-dare-card__token-wrapper">
            <button
              type="button"
              className="btn btn--ghost truth-dare-card__token"
              onClick={handleReroll}
            >
              Сменить карту ({player.tokens.rerollSameLevel})
            </button>
            <p className="truth-dare-card__token-hint">
              Получить новое задание того же уровня
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default TruthDareCard
