import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSabotageGame } from '../games/sabotage/SabotageGameContext'
import { useBack } from '../hooks/useBack'
import { haptic } from '../utils/telegram'
import { hapticImpact } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import './SabotageTask.css'

function SabotageTask() {
  const navigate = useNavigate()
  const { state } = useSabotageGame()
  const [secondsLeft, setSecondsLeft] = useState(state.taskDurationSeconds)
  const endAtRef = useRef(0)

  if (!state.players.length) {
    navigate('/sabotage')
    return null
  }

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

  const handleBack = useBack('/sabotage/role')

  const handleVote = () => {
    haptic('medium')
    navigate('/sabotage/vote')
  }

  const isLastTen = secondsLeft > 0 && secondsLeft <= 10

  return (
    <div className="sabotage-task">
      <div className="sabotage-task__top">
        <HomeButton />
        <button type="button" className="btn btn--ghost sabotage-task__back" onClick={handleBack}>
          ← В меню
        </button>
      </div>

      <div className={`sabotage-task__timer-wrap ${isLastTen ? 'sabotage-task__timer-wrap--urgent' : ''}`}>
        <div
          className="sabotage-task__timer-bar"
          style={{ width: `${(secondsLeft / state.taskDurationSeconds) * 100}%` }}
        />
        <span className="sabotage-task__timer-text">{secondsLeft}</span>
      </div>

      <div className="sabotage-task__card card">
        <p className="sabotage-task__label">Задание</p>
        <h2 className="sabotage-task__task">{state.task}</h2>
      </div>

      <div className="sabotage-task__actions">
        <button type="button" className="btn btn--primary sabotage-task__btn" onClick={handleVote}>
          Перейти к голосованию
        </button>
      </div>
    </div>
  )
}

export default SabotageTask
