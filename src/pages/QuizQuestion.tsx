import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuizGame } from '../games/quiz/QuizGameContext'
import { hapticSelection, hapticImpact } from '../utils/haptics'
import { haptic } from '../utils/telegram'
import { trackEvent } from '../lib/analytics'
import HomeButton from '../components/HomeButton'
import './QuizQuestion.css'

const TIMER_TOTAL = 15
const CLUTCH_SEC = 3

function QuizQuestion() {
  const navigate = useNavigate()
  const { state, dispatch } = useQuizGame()
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  const question = state.questionQueue[state.currentQuestionIndex]
  const currentPlayer = state.players[state.currentPlayerIndex]

  const startRef = useRef(state.questionStartTime || Date.now())

  useEffect(() => {
    trackEvent('start_game', { gameId: 'quiz' })
  }, [])

  useEffect(() => {
    startRef.current = state.questionStartTime || Date.now()
  }, [state.currentQuestionIndex, state.currentPlayerIndex])

  useEffect(() => {
    if (state.phase !== 'question' || !question) return
    
    if (state.currentMultiplier === null) {
      dispatch({ type: 'SELECT_BET', multiplier: 1 })
    }
    
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startRef.current) / 1000)
      const bonus = state.uiFlags.pauseBonusSeconds ?? 0
      const left = Math.max(0, TIMER_TOTAL + bonus - elapsed)
      dispatch({ type: 'TIMER_TICK', leftSec: left })
      if (left <= CLUTCH_SEC && left > 0) {
        hapticImpact('medium')
      }
      if (left <= 0) {
        if (timerRef.current) clearInterval(timerRef.current)
        dispatch({ type: 'TIMER_TIMEOUT' })
      }
    }, 250)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [state.phase, state.currentQuestionIndex, state.currentPlayerIndex, state.uiFlags.pauseBonusSeconds, state.currentMultiplier, dispatch])

  useEffect(() => {
    if (state.phase === 'result') navigate('/quiz/result')
  }, [state.phase, navigate])

  const handleAnswer = (idx: number) => {
    if (state.round[currentPlayer?.id ?? '']) return
    hapticSelection()
    const timeMs = Date.now() - state.questionStartTime
    dispatch({ type: 'ANSWER', playerId: currentPlayer!.id, answerIndex: idx, timeMs })
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
  const isClutch = state.timer.leftSec > 0 && state.timer.leftSec <= CLUTCH_SEC

  return (
    <div className="quiz-question">
      <div className="quiz-question__top">
        <button type="button" className="btn btn--ghost quiz-question__back" onClick={handleBack}>
          ←
        </button>
        <HomeButton onBeforeNavigate={handleHomeClick} />
      </div>

      <div className="quiz-question__score-bar">
        <span className="quiz-question__score-item">
          Вопрос {state.currentQuestionIndex + 1} / {state.totalQuestions}
        </span>
        <span className="quiz-question__score-item quiz-question__score-item--highlight">
          {currentPlayer.name}
        </span>
      </div>

      <div className={`quiz-question__timer ${isClutch ? 'quiz-question__timer--clutch' : ''}`}>
        <div
          className="quiz-question__timer-bar"
          style={{ width: `${(state.timer.leftSec / TIMER_TOTAL) * 100}%` }}
        />
        <span className="quiz-question__timer-text">{state.timer.leftSec} сек</span>
      </div>

      <div className="quiz-question__card card">
        <p className="quiz-question__text">{question.text}</p>
      </div>

      <div className="quiz-question__answers">
        {question.answers.map((ans, idx) => (
          <button
            key={idx}
            type="button"
            className="btn card quiz-question__answer"
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
          className="btn btn--ghost quiz-question__exit"
          onClick={handleBack}
        >
          Выйти из игры
        </button>
      </div>

      {showExitConfirm && (
        <div className="quiz-question__modal-overlay" onClick={() => handleExitConfirm(false)}>
          <div className="quiz-question__modal card" onClick={(e) => e.stopPropagation()}>
            <p className="quiz-question__modal-text">Выйти из игры?</p>
            <p className="quiz-question__modal-hint">
              Если выйти, весь прогресс будет сброшен.
            </p>
            <div className="quiz-question__modal-btns">
              <button type="button" className="btn btn--ghost" onClick={() => handleExitConfirm(false)}>
                Остаться
              </button>
              <button type="button" className="btn btn--primary" onClick={() => handleExitConfirm(true)}>
                Выйти
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default QuizQuestion
