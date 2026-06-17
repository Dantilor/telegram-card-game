import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTruthDare } from '../games/truth-dare/TruthDareContext'
import { useBack } from '../hooks/useBack'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
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
    <div className="game-page truth-dare-card">
      <div className="game-page__top">
        <HomeButton className="game-page__nav-btn" />
        <BackButton onClick={handleBack} className="game-page__nav-btn game-page__back" />
      </div>

      <span className="game-page__progress">Уровень {card.level}</span>

      <div className="truth-dare-card__card game-page__panel game-page__panel--glow-b">
        <p className="truth-dare-card__type">{card.type === 'truth' ? 'Правда' : 'Действие'}</p>
        <p className="truth-dare-card__text">{card.text}</p>
      </div>

      <div className="truth-dare-card__actions">
        <button
          type="button"
          className="game-page__cta"
          onClick={handleCompleted}
        >
          Выполнено
        </button>
        {!state.forcedNoRefuse && (
          <button
            type="button"
            className="game-page__btn game-page__btn--secondary"
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
              className="truth-dare-card__token"
              onClick={handleReroll}
            >
              Сменить карту ({player.tokens.rerollSameLevel})
            </button>
            <p className="game-page__hint truth-dare-card__token-hint">
              Получить новое задание того же уровня
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default TruthDareCard
