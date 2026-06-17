import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSabotageGame } from '../games/sabotage/SabotageGameContext'
import { haptic } from '../utils/telegram'
import { hapticImpact } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
import './SabotageTask.css'

function SabotageTask() {
  const navigate = useNavigate()
  const { state, dispatch } = useSabotageGame()
  const [secondsLeft, setSecondsLeft] = useState(state.taskDurationSeconds)
  const endAtRef = useRef(0)

  useEffect(() => {
    if (!state.players.length) {
      navigate('/sabotage')
    }
  }, [state.players.length, navigate])

  useEffect(() => {
    endAtRef.current = Date.now() + state.taskDurationSeconds * 1000
    setSecondsLeft(state.taskDurationSeconds)
    const iv = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000))
      setSecondsLeft(remaining)
      if (remaining === 0) {
        hapticImpact('medium')
      }
    }, 250)
    return () => clearInterval(iv)
  }, [state.taskDurationSeconds])

  useEffect(() => {
    if (secondsLeft === 0) {
      const t = setTimeout(() => navigate('/sabotage/vote'), 800)
      return () => clearTimeout(t)
    }
  }, [secondsLeft, navigate])

  const handleBack = useCallback(() => {
    dispatch({ type: 'BACK_FROM_TASK' })
    navigate('/sabotage/role')
  }, [dispatch, navigate])

  if (!state.players.length) {
    return null
  }

  const handleVote = () => {
    haptic('medium')
    navigate('/sabotage/vote')
  }

  const isLastTen = secondsLeft > 0 && secondsLeft <= 10

  return (
    <div className="game-page sabotage-task sabotage-flow game-page--enter">
      <div className="game-page__top">
        <HomeButton className="game-page__nav-btn" />
        <BackButton onClick={handleBack} className="game-page__nav-btn game-page__back" />
      </div>

      <div className={`sabotage-task__timer-wrap ${isLastTen ? 'sabotage-task__timer-wrap--urgent' : ''}`}>
        <div
          className={`sabotage-task__timer-bar ${isLastTen ? 'sabotage-task__timer-bar--pulse' : ''}`}
          style={{ width: `${(secondsLeft / state.taskDurationSeconds) * 100}%` }}
        />
        <span className="sabotage-task__timer-text">{secondsLeft}</span>
      </div>

      <div className="sabotage-task__card game-page__panel game-page__panel--glow-b">
        <p className="sabotage-task__label">Задание</p>
        <h2 className="sabotage-task__task">{state.task}</h2>
      </div>

      <div className="game-page__actions">
        <button type="button" className="game-page__cta" onClick={handleVote}>
          Перейти к голосованию
        </button>
      </div>
    </div>
  )
}

export default SabotageTask
