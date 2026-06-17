import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuizGame } from '../games/quiz/QuizGameContext'
import { hapticSelection, hapticImpact } from '../utils/haptics'
import { haptic } from '../utils/telegram'
import { trackEvent } from '../lib/analytics'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
import './QuizQuestion.css'

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
      const totalSec = state.timer.totalSec
      const elapsed = Math.floor((Date.now() - startRef.current) / 1000)
      const bonus = state.uiFlags.pauseBonusSeconds ?? 0
      const left = Math.max(0, totalSec + bonus - elapsed)
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
  }, [state.phase, state.currentQuestionIndex, state.currentPlayerIndex, state.timer.totalSec, state.uiFlags.pauseBonusSeconds, state.currentMultiplier, dispatch])

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
    <div className="game-page quiz-question">
      <div className="game-page__top">
        <HomeButton className="game-page__nav-btn" onBeforeNavigate={handleHomeClick} />
        <BackButton onClick={handleBack} className="game-page__nav-btn game-page__back" />
      </div>

      <div className="quiz-question__turn-banner game-page__panel game-page__panel--glow-a" role="status">
        <span className="quiz-question__turn-label">Вопрос к участнику</span>
        <span className="quiz-question__turn-name">{currentPlayer.name}</span>
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
          className={`quiz-question__timer-bar ${isClutch ? 'quiz-question__timer-bar--pulse' : ''}`}
          style={{ width: `${state.timer.totalSec > 0 ? (state.timer.leftSec / state.timer.totalSec) * 100 : 0}%` }}
        />
        <span className="quiz-question__timer-text">{state.timer.leftSec} сек</span>
      </div>

      <div className="quiz-question__card game-page__panel game-page__panel--glow-b">
        <p className="quiz-question__text">{question.text}</p>
      </div>

      <div className="quiz-question__answers">
        {question.answers.map((ans, idx) => (
          <button
            key={idx}
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
        <div className="game-page__modal-overlay" onClick={() => handleExitConfirm(false)}>
          <div className="game-page__modal game-page__panel game-page__panel--glow-b" onClick={(e) => e.stopPropagation()}>
            <p className="game-page__modal-text">Выйти из игры?</p>
            <p className="game-page__modal-hint">
              Если выйти, весь прогресс будет сброшен.
            </p>
            <div className="quiz-question__modal-btns">
              <button type="button" className="game-page__btn game-page__btn--secondary" onClick={() => handleExitConfirm(false)}>
                Остаться
              </button>
              <button type="button" className="game-page__cta" onClick={() => handleExitConfirm(true)}>
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
