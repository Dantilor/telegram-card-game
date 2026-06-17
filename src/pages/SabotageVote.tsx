import { useNavigate } from 'react-router-dom'
import { useSabotageGame } from '../games/sabotage/SabotageGameContext'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
import './SabotageVote.css'

function SabotageVote() {
  const navigate = useNavigate()
  const { state, dispatch } = useSabotageGame()

  if (!state.players.length) {
    navigate('/sabotage')
    return null
  }

  if (state.phase === 'result') {
    navigate('/sabotage/result', { replace: true })
    return null
  }

  const currentVoter = state.players[state.voteCollectIndex]
  const targets = state.players.filter((p) => p.id !== currentVoter?.id)

  const handleBack = () => {
    haptic('light')
    dispatch({ type: 'RESET' })
    navigate('/sabotage')
  }

  const handleVote = (targetId: string) => {
    if (!currentVoter) return
    hapticSelection()
    dispatch({ type: 'SET_VOTE', voterId: currentVoter.id, targetId })
    dispatch({ type: 'NEXT_VOTE_COLLECT' })
  }

  if (!currentVoter || targets.length === 0) {
    navigate('/sabotage/result', { replace: true })
    return null
  }

  return (
    <div className="game-page sabotage-vote sabotage-flow">
      <div className="game-page__top">
        <HomeButton className="game-page__nav-btn" />
        <BackButton onClick={handleBack} className="game-page__nav-btn game-page__back" />
      </div>

      <h2 className="game-page__screen-title">Кто саботёр?</h2>
      <p className="game-page__screen-subtitle">
        {currentVoter.name}, кого подозреваешь?
      </p>

      <div className="sabotage-vote__targets">
        {targets.map((p) => (
          <button
            key={p.id}
            type="button"
            className="game-page__target sabotage-vote__target"
            onClick={() => handleVote(p.id)}
          >
            {p.name}
          </button>
        ))}
      </div>

      <p className="game-page__progress">
        {state.voteCollectIndex + 1} / {state.players.length}
      </p>
    </div>
  )
}

export default SabotageVote
