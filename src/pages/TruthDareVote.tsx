import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTruthDare } from '../games/truth-dare/TruthDareContext'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
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

  const handleVote = (vote: 'ok' | 'harder') => {
    if (!currentVoter) return
    hapticSelection()
    dispatch({ type: 'VOTE', playerId: currentVoter.id, vote })
  }

  const handleFinish = () => {
    hapticSelection()
    dispatch({ type: 'FINISH_VOTE' })
  }

  const handleBack = () => {
    haptic('light')
    navigate('/truth-dare')
  }

  if (state.phase !== 'vote') return null

  return (
    <div className="truth-dare-vote">
      <div className="truth-dare-vote__top">
        <button type="button" className="btn btn--ghost truth-dare-vote__back" onClick={handleBack}>
          ←
        </button>
        <HomeButton />
      </div>

      <h2 className="truth-dare-vote__title">Голосование</h2>
      <p className="truth-dare-vote__subtitle">
        {currentPlayer?.name} выполнил(а). {currentVoter ? `${currentVoter.name}, ваше решение:` : 'Все проголосовали.'}
      </p>

      {currentVoter ? (
        <div className="truth-dare-vote__choices">
          <button
            type="button"
            className="btn truth-dare-vote__btn truth-dare-vote__btn--ok"
            onClick={() => handleVote('ok')}
          >
            👍 Засчитано
          </button>
          <button
            type="button"
            className="btn truth-dare-vote__btn truth-dare-vote__btn--harder"
            onClick={() => handleVote('harder')}
          >
            😈 Жёстче
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn--primary truth-dare-vote__finish"
          onClick={handleFinish}
        >
          Продолжить
        </button>
      )}

      <p className="truth-dare-vote__hint">
        Проголосовало: {Object.keys(state.vote.votes).length} / {voters.length}
      </p>
    </div>
  )
}

export default TruthDareVote
