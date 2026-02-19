import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useMafiaGame } from '../games/mafia/MafiaGameContext'
import { useBack } from '../hooks/useBack'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import './MafiaVoting.css'

function MafiaVoting() {
  const navigate = useNavigate()
  const location = useLocation()
  const { state, dispatch } = useMafiaGame()
  const handleBack = useBack('/mafia/day')

  useEffect(() => {
    if (state.winner && location.pathname !== '/mafia/result') {
      navigate('/mafia/result')
    } else if (state.phase === 'night_intro' && location.pathname !== '/mafia/night') {
      navigate('/mafia/night')
    }
  }, [state.phase, state.winner, location.pathname, navigate])

  useEffect(() => {
    if (!state.players.length && location.pathname.startsWith('/mafia')) {
      navigate('/mafia')
    }
  }, [state.players.length, location.pathname, navigate])

  if (!state.players.length) {
    return null
  }

  const alive = state.players.filter((p) => p.alive)
  const currentVoter = alive[state.voteCollectIndex]
  const targets = alive.filter((p) => p.id !== currentVoter?.id)

  if (state.phase === 'voting_summary') {
    const targetPlayer = state.votingSummaryTargetId
      ? state.players.find((p) => p.id === state.votingSummaryTargetId)
      : null
    return (
      <div className="mafia-voting">
        <div className="mafia-voting__top">
          <HomeButton />
          <button type="button" className="btn btn--ghost mafia-voting__back" onClick={handleBack}>
            ← В меню
          </button>
        </div>
        <div className="mafia-voting__summary card">
          <h2 className="mafia-voting__summary-title">Решение принято.</h2>
          <p className="mafia-voting__summary-text">
            {targetPlayer ? `Большинство выбрало: ${targetPlayer.name}` : 'Ничья. Никого не исключили.'}
          </p>
          <p className="mafia-voting__summary-hint">Толпа не ошибается… или ошибается?</p>
          <button
            type="button"
            className="btn btn--primary mafia-voting__summary-btn"
            onClick={() => {
              hapticSelection()
              dispatch({ type: 'CONFIRM_VOTING' })
            }}
          >
            Перейти к результату
          </button>
        </div>
      </div>
    )
  }

  const handleVote = (targetId: string) => {
    if (!currentVoter) return
    hapticSelection()
    dispatch({ type: 'SET_VOTE', voterId: currentVoter.id, targetId })
    dispatch({ type: 'NEXT_VOTE_COLLECT' })
  }

  // Редирект при невалидном состоянии (никого не осталось) в эффекте, не в рендере
  const aliveCount = state.players.filter((p) => p.alive).length
  useEffect(() => {
    if (state.phase !== 'voting_collect') return
    if (aliveCount > 1) return
    if (location.pathname !== '/mafia/night') navigate('/mafia/night')
  }, [state.phase, aliveCount, location.pathname, navigate])

  if (!currentVoter || alive.length <= 1) {
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

      <h2 className="mafia-voting__title">Город требует крови.</h2>
      <p className="mafia-voting__subtitle">Кто выглядит подозрительно?</p>
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
