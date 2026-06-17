import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTruthDare } from '../games/truth-dare/TruthDareContext'
import { useBack } from '../hooks/useBack'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
import './TruthDareVote.css'

function TruthDareVote() {
  const navigate = useNavigate()
  const { state, dispatch } = useTruthDare()

  const currentPlayer = state.players[state.currentPlayerIndex]
  const voters = state.players.filter((p) => p.id !== currentPlayer?.id)
  const currentVoter = voters.find((p) => !state.vote.votes[p.id])

  useEffect(() => {
    if (state.phase === 'choice') navigate('/truth-dare/turn')
    if (state.phase === 'result') navigate('/truth-dare/result')
  }, [state.phase, navigate])

  const handleVote = (vote: 'ok' | 'notCounted') => {
    if (!currentVoter) return
    hapticSelection()
    dispatch({ type: 'VOTE', playerId: currentVoter.id, vote })
  }

  const handleFinish = () => {
    hapticSelection()
    dispatch({ type: 'FINISH_VOTE' })
  }

  const handleBack = useBack('/truth-dare/card')

  if (state.phase !== 'vote') return null

  return (
    <div className="game-page truth-dare-vote">
      <div className="game-page__top">
        <HomeButton className="game-page__nav-btn" />
        <BackButton onClick={handleBack} className="game-page__nav-btn game-page__back" />
      </div>

      <h2 className="game-page__screen-title">Голосование</h2>
      <p className="game-page__screen-subtitle">
        {currentPlayer?.name} выполнил задание.
      </p>
      <p className="game-page__screen-subtitle">
        {currentVoter ? `${currentVoter.name}, засчитываем или нет?` : 'Все проголосовали.'}
      </p>

      {currentVoter ? (
        <div className="truth-dare-vote__choices">
          <button
            type="button"
            className="game-page__cta truth-dare-vote__btn--ok"
            onClick={() => handleVote('ok')}
          >
            👍 Засчитано
          </button>
          <button
            type="button"
            className="game-page__btn game-page__btn--secondary"
            onClick={() => handleVote('notCounted')}
          >
            ❌ Не засчитано
          </button>
        </div>
      ) : (
        <div className="truth-dare-vote__finish-wrap">
          <button
            type="button"
            className="game-page__cta"
            onClick={handleFinish}
          >
            Продолжить
          </button>
        </div>
      )}

      <p className="game-page__hint truth-dare-vote__hint">
        Проголосовало: {Object.keys(state.vote.votes).length} / {voters.length}
      </p>
    </div>
  )
}

export default TruthDareVote
