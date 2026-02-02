import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useActivityGame } from '../games/activity/hooks/useActivityGame'
import { TASK_LABELS } from '../games/activity/types'
import type { ActivityCategory } from '../games/activity/data/activityWords'
import { haptic } from '../utils/telegram'
import { hapticSelection, hapticSuccess } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import './ActivityPlay.css'

function ActivityPlay() {
  const navigate = useNavigate()
  const location = useLocation()
  const { mode = 'solo', timerSeconds = 60, category } = (location.state as {
    mode?: 'solo' | 'team'
    timerSeconds?: 30 | 45 | 60
    category?: ActivityCategory
  }) ?? {}

  const game = useActivityGame(mode, timerSeconds ?? 60, category ?? null)
  const [secondsLeft, setSecondsLeft] = useState<number>(timerSeconds ?? 60)
  const [showTimeOverlay, setShowTimeOverlay] = useState(false)
  const endAtRef = useRef(0)

  const isTimeUp = secondsLeft <= 0

  useEffect(() => {
    if (!category) {
      navigate('/activity')
      return
    }
  }, [category, navigate])

  useEffect(() => {
    endAtRef.current = Date.now() + (timerSeconds ?? 60) * 1000
    setSecondsLeft(timerSeconds ?? 60)
    const iv = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000))
      setSecondsLeft(remaining)
    }, 250)
    return () => clearInterval(iv)
  }, [game.taskType, game.word])

  useEffect(() => {
    if (secondsLeft === 0) {
      setShowTimeOverlay(true)
    }
  }, [secondsLeft])

  const handleGuessed = () => {
    hapticSuccess()
    game.addPoint()
    goNextRound()
  }

  const goNextRound = useCallback(() => {
    setShowTimeOverlay(false)
    if (mode === 'team') game.switchTeam()
    game.nextRound()
    const sec = timerSeconds ?? 60
    setSecondsLeft(sec)
    endAtRef.current = Date.now() + sec * 1000
  }, [game.nextRound, game.switchTeam, timerSeconds, mode])

  const handleSkip = () => {
    if (!isTimeUp) {
      haptic('light')
      goNextRound()
    }
  }

  const handleNextRound = () => {
    hapticSelection()
    goNextRound()
  }

  const handleBack = () => {
    haptic('light')
    navigate('/activity')
  }

  const handleFinish = () => {
    hapticSelection()
    navigate('/activity/result', {
      state: { scores: game.scores, mode },
    })
  }

  if (!category) return null

  return (
    <div className="activity-play">
      <div className="activity-play__top">
        <button type="button" className="btn btn--ghost activity-play__back" onClick={handleBack}>
          ← Назад
        </button>
        <HomeButton />
      </div>

      {mode === 'team' && (
        <div className="activity-play__teams">
          <span className={game.currentTeam === 'A' ? 'activity-play__team--active' : ''}>
            A: {game.scores.teamA}
          </span>
          <span className={game.currentTeam === 'B' ? 'activity-play__team--active' : ''}>
            B: {game.scores.teamB}
          </span>
        </div>
      )}

      <div className="activity-play__timer-wrap">
        <div
          className="activity-play__timer-bar"
          style={{ width: `${(secondsLeft / (timerSeconds ?? 60)) * 100}%` }}
        />
        <span className="activity-play__timer-text">{secondsLeft}</span>
      </div>

      <div className="activity-play__card card">
        <h2 className="activity-play__task">{TASK_LABELS[game.taskType]}</h2>
        <p className="activity-play__word">{game.word}</p>
      </div>

      {!showTimeOverlay ? (
        <div className="activity-play__actions">
          <button
            type="button"
            className="btn btn--primary activity-play__btn"
            onClick={handleGuessed}
          >
            Угадали
          </button>
          <button
            type="button"
            className="btn btn--secondary activity-play__btn"
            onClick={handleSkip}
          >
            Пропуск
          </button>
        </div>
      ) : (
        <div className="activity-play__overlay">
          <div className="activity-play__overlay-card card">
            <h2 className="activity-play__overlay-title">Время вышло</h2>
            <div className="activity-play__overlay-actions">
              <button
                type="button"
                className="btn btn--primary activity-play__btn"
                onClick={handleGuessed}
              >
                Угадали
              </button>
              <button
                type="button"
                className="btn btn--secondary activity-play__btn"
                onClick={handleNextRound}
              >
                Следующий раунд
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="activity-play__footer">
        <button
          type="button"
          className="btn btn--ghost activity-play__finish"
          onClick={handleFinish}
        >
          Завершить игру
        </button>
      </div>
    </div>
  )
}

export default ActivityPlay
