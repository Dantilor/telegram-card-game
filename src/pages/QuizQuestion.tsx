import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuizGame } from '../games/quiz/QuizGameContext'
import { hapticSelection, hapticImpact } from '../utils/haptics'
import { haptic } from '../utils/telegram'
import { trackEvent } from '../lib/analytics'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
import GameExitConfirmModal from '../components/GameExitConfirmModal'
import './QuizQuestion.css'

const CLUTCH_SEC = 3
const TIMER_TICK_MS = 250

function blurActiveElement() {
  const active = document.activeElement
  if (active instanceof HTMLElement) {
    active.blur()
  }
}

function QuizQuestion() {
  const navigate = useNavigate()
  const { state, dispatch } = useQuizGame()
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const clutchHapticRef = useRef(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  const question = state.questionQueue[state.currentQuestionIndex]
  const currentPlayer = state.players[state.currentPlayerIndex]
  const turnKey = `${state.currentQuestionIndex}-${state.currentPlayerIndex}`

  const startRef = useRef(state.questionStartTime || Date.now())
  const [leftSec, setLeftSec] = useState(state.timer.leftSec)

  useEffect(() => {
    trackEvent('start_game', { gameId: 'quiz' })
  }, [])

  useEffect(() => {
    startRef.current = state.questionStartTime || Date.now()
    const bonus = state.uiFlags.pauseBonusSeconds ?? 0
    setLeftSec(state.timer.totalSec + bonus)
    clutchHapticRef.current = false
    blurActiveElement()
  }, [turnKey, state.questionStartTime, state.timer.totalSec, state.uiFlags.pauseBonusSeconds])

  useEffect(() => {
    if (state.phase !== 'question' || !question || !currentPlayer) return

    const playerId = currentPlayer.id
    const totalSec = state.timer.totalSec
    const pauseBonusSeconds = state.uiFlags.pauseBonusSeconds ?? 0

    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startRef.current) / 1000)
      const nextLeft = Math.max(0, totalSec + pauseBonusSeconds - elapsed)
      setLeftSec(nextLeft)

      if (nextLeft <= CLUTCH_SEC && nextLeft > 0 && !clutchHapticRef.current) {
        clutchHapticRef.current = true
        hapticImpact('medium')
      }

      if (nextLeft <= 0) {
        if (timerRef.current) clearInterval(timerRef.current)
        timerRef.current = null
        dispatch({ type: 'TIMER_TIMEOUT', playerId })
      }
    }, TIMER_TICK_MS)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [
    state.phase,
    state.currentQuestionIndex,
    state.currentPlayerIndex,
    state.timer.totalSec,
    state.uiFlags.pauseBonusSeconds,
    currentPlayer?.id,
    dispatch,
    question,
  ])

  useEffect(() => {
    if (state.phase === 'result') navigate('/quiz/result')
  }, [state.phase, navigate])

  const clearQuestionTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
  }

  const handleAnswer = (idx: number) => {
    if (!currentPlayer) return
    if (state.round[currentPlayer.id]) return

    clearQuestionTimer()
    hapticSelection()
    blurActiveElement()

    const timeMs = Date.now() - startRef.current
    dispatch({ type: 'ANSWER', playerId: currentPlayer.id, answerIndex: idx, timeMs })
  }

  const handleBack = () => {
    setShowExitConfirm(true)
  }

  const handleExitConfirm = (confirmed: boolean) => {
    setShowExitConfirm(false)
    if (!confirmed) return
    haptic('light')
    dispatch({ type: 'RESET' })
    navigate('/quiz')
  }

  const handleHomeClick = () => {
    setShowExitConfirm(true)
    return true
  }

  if (!question || !currentPlayer) {
    navigate('/quiz')
    return null
  }

  const hasAnswered = !!state.round[currentPlayer.id]
  const canAnswer = !hasAnswered
  const isClutch = leftSec > 0 && leftSec <= CLUTCH_SEC
  const timerProgress =
    state.timer.totalSec > 0 ? (leftSec / state.timer.totalSec) * 100 : 0

  return (
    <div className="game-page quiz-question">
      <div className="game-page__top">
        <HomeButton className="game-page__nav-btn" onBeforeNavigate={handleHomeClick} />
        <BackButton onClick={handleBack} className="game-page__nav-btn game-page__back" />
      </div>

      <div
        className="quiz-question__turn-banner game-page__panel game-page__panel--glow-a"
        role="status"
        aria-live="polite"
      >
        <span className="quiz-question__turn-label">Вопрос к участнику</span>
        <span className="quiz-question__turn-name">{currentPlayer.name}</span>
      </div>

      <div className="quiz-question__score-bar">
        <span className="quiz-question__score-item">
          Вопрос {state.currentQuestionIndex + 1} / {state.totalQuestions}
        </span>
      </div>

      <div className={`quiz-question__timer ${isClutch ? 'quiz-question__timer--clutch' : ''}`}>
        <div
          className={`quiz-question__timer-bar ${isClutch ? 'quiz-question__timer-bar--pulse' : ''}`}
          style={{ width: `${timerProgress}%` }}
        />
        <span className="quiz-question__timer-text">{leftSec} сек</span>
      </div>

      <div className="quiz-question__card game-page__panel game-page__panel--glow-b">
        <p className="quiz-question__text">{question.text}</p>
      </div>

      <div key={turnKey} className="quiz-question__answers">
        {question.answers.map((ans, idx) => (
          <button
            key={`${turnKey}-${idx}`}
            type="button"
            className="game-page__target quiz-question__answer"
            onClick={() => handleAnswer(idx)}
            disabled={!canAnswer}
          >
            {ans}
          </button>
        ))}
      </div>

      <div className="quiz-question__footer">
        <button
          type="button"
          className="quiz-question__exit"
          onClick={handleBack}
        >
          Выйти из игры
        </button>
      </div>

      {showExitConfirm && (
        <GameExitConfirmModal
          hint="Если выйти, весь прогресс будет сброшен."
          onCancel={() => handleExitConfirm(false)}
          onConfirm={() => handleExitConfirm(true)}
        />
      )}
    </div>
  )
}

export default QuizQuestion
