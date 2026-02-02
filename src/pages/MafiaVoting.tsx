import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMafiaGame } from '../games/mafia/MafiaGameContext'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import './MafiaVoting.css'

function MafiaVoting() {
  const navigate = useNavigate()
  const { state, dispatch } = useMafiaGame()
  if (!state.players.length) {
    navigate('/mafia')
    return null
  }

  const alive = state.players.filter((p) => p.alive)
  const currentVoter = alive[state.voteCollectIndex]
  const targets = alive.filter((p) => p.id !== currentVoter?.id)

  useEffect(() => {
    if (state.winner) {
      navigate('/mafia/result')
    } else if (state.phase === 'night_intro') {
      navigate('/mafia/night')
    }
  }, [state.phase, state.winner, navigate])

  const handleBack = () => {
    haptic('light')
    navigate('/mafia')
  }

  const handleVote = (targetId: string) => {
    if (!currentVoter) return
    hapticSelection()
    dispatch({ type: 'SET_VOTE', voterId: currentVoter.id, targetId })
    dispatch({ type: 'NEXT_VOTE_COLLECT' })
  }

  if (!currentVoter || alive.length <= 1) {
    navigate('/mafia/night')
    return null
  }

  if (targets.length === 0) {
    return (
      <div className="mafia-voting">
        <p>Не за кого голосовать</p>
      </div>
    )
  }

  return (
    <div className="mafia-voting">
      <div className="mafia-voting__top">
        <HomeButton />
        <button type="button" className="btn btn--ghost mafia-voting__back" onClick={handleBack}>
          ← В меню
        </button>
      </div>

      <h2 className="mafia-voting__title">Голосование</h2>
      <p className="mafia-voting__voter">
        {currentVoter.name}, кого исключить?
      </p>

      <div className="mafia-voting__targets">
        {targets.map((p) => (
          <button
            key={p.id}
            type="button"
            className="btn card mafia-voting__target"
            onClick={() => handleVote(p.id)}
          >
            {p.name}
          </button>
        ))}
      </div>

      <p className="mafia-voting__hint">
        {state.voteCollectIndex + 1} / {alive.length}
      </p>
    </div>
  )
}

export default MafiaVoting
