import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuizGame } from '../games/quiz/QuizGameContext'
import { useBack } from '../hooks/useBack'
import { hapticSelection, hapticImpact } from '../utils/haptics'
import { trackEvent } from '../lib/analytics'
import HomeButton from '../components/HomeButton'
import './QuizQuestion.css'

const TIMER_TOTAL = 15
const CLUTCH_SEC = 3

function QuizQuestion() {
  const navigate = useNavigate()
  const { state, dispatch } = useQuizGame()
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const question = state.questionQueue[state.currentQuestionIndex]
  const currentPlayer = state.players[state.currentPlayerIndex]
  const hidden = state.uiFlags.fiftyFiftyHiddenIndices

  const startRef = useRef(state.questionStartTime || Date.now())

  useEffect(() => {
    trackEvent('start_game', { gameId: 'quiz' })
  }, [])

  useEffect(() => {
    startRef.current = state.questionStartTime || Date.now()
  }, [state.currentQuestionIndex, state.currentPlayerIndex])

  useEffect(() => {
    if (state.phase !== 'question' || !question) return
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
  }, [state.phase, state.currentQuestionIndex, state.currentPlayerIndex, state.uiFlags.pauseBonusSeconds])

  useEffect(() => {
    if (state.phase === 'result') navigate('/quiz/result')
  }, [state.phase, navigate])


  const handleBet = (m: 1 | 2 | 3) => {
    hapticSelection()
    dispatch({ type: 'SELECT_BET', multiplier: m })
  }

  const handleAnswer = (idx: number) => {
    if (state.currentMultiplier === null) return
    if (state.round[currentPlayer?.id ?? '']) return
    hapticSelection()
    const timeMs = Date.now() - state.questionStartTime
    dispatch({ type: 'ANSWER', playerId: currentPlayer!.id, answerIndex: idx, timeMs })
  }

  const handleFiftyFifty = () => {
    if ((currentPlayer?.boosters.fiftyFifty ?? 0) <= (currentPlayer?.usedBoostersThisGame.fiftyFifty ?? 0)) return
    hapticSelection()
    dispatch({ type: 'USE_FIFTY_FIFTY' })
  }

  const handlePause = () => {
    if ((currentPlayer?.boosters.pause ?? 0) <= (currentPlayer?.usedBoostersThisGame.pause ?? 0)) return
    hapticSelection()
    dispatch({ type: 'USE_PAUSE' })
  }

  const handleInsurance = () => {
    if ((currentPlayer?.boosters.insurance ?? 0) <= (currentPlayer?.usedBoostersThisGame.insurance ?? 0)) return
    hapticSelection()
    dispatch({ type: 'USE_INSURANCE' })
  }

  const handleBack = useBack('/quiz')

  if (!question || !currentPlayer) {
    navigate('/quiz')
    return null
  }

  const hasAnswered = !!state.round[currentPlayer.id]
  const canAnswer = !hasAnswered && state.currentMultiplier !== null
  const isClutch = state.timer.leftSec > 0 && state.timer.leftSec <= CLUTCH_SEC

  return (
    <div className="quiz-question">
      <div className="quiz-question__top">
        <button type="button" className="btn btn--ghost quiz-question__back" onClick={handleBack}>
          ←
        </button>
        <HomeButton />
      </div>

      <div className="quiz-question__meta">
        <span>Вопрос {state.currentQuestionIndex + 1} / {state.totalQuestions}</span>
        {state.mode === 'room' && (
          <span className="quiz-question__player">Игрок: {currentPlayer.name}</span>
        )}
      </div>

      <div className={`quiz-question__timer ${isClutch ? 'quiz-question__timer--clutch' : ''}`}>
        <div
          className="quiz-question__timer-bar"
          style={{ width: `${(state.timer.leftSec / TIMER_TOTAL) * 100}%` }}
        />
        <span className="quiz-question__timer-text">{state.timer.leftSec}</span>
      </div>

      <div className="quiz-question__card card">
        <p className="quiz-question__text">{question.text}</p>
      </div>

      {!hasAnswered && (
        <div className="quiz-question__bets">
          <span className="quiz-question__bet-label">Ставка:</span>
          {([1, 2, 3] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={`btn quiz-question__bet-btn ${state.currentMultiplier === m ? 'is-active' : ''}`}
              onClick={() => handleBet(m)}
            >
              x{m}
            </button>
          ))}
        </div>
      )}

      {!hasAnswered && (
        <div className="quiz-question__boosters">
          {(currentPlayer.boosters.fiftyFifty > currentPlayer.usedBoostersThisGame.fiftyFifty) && (
            <button type="button" className="btn btn--ghost quiz-question__booster" onClick={handleFiftyFifty}>
              50/50
            </button>
          )}
          {(currentPlayer.boosters.pause > currentPlayer.usedBoostersThisGame.pause) && (
            <button type="button" className="btn btn--ghost quiz-question__booster" onClick={handlePause}>
              Pause
            </button>
          )}
          {(currentPlayer.boosters.insurance > currentPlayer.usedBoostersThisGame.insurance) && (
            <button type="button" className="btn btn--ghost quiz-question__booster" onClick={handleInsurance}>
              Insurance
            </button>
          )}
        </div>
      )}

      <div className="quiz-question__streak">
        {currentPlayer.streak > 0 && (
          <span className="quiz-question__streak-badge">
            Стрик: {currentPlayer.streak}
            {currentPlayer.streak >= 3 && ' 🔥'}
            {currentPlayer.streak >= 5 && ' 🦁'}
          </span>
        )}
      </div>

      <div className="quiz-question__answers">
        {question.answers.map((ans, idx) => {
          const isHidden = hidden.includes(idx)
          if (isHidden) return null
          return (
            <button
              key={idx}
              type="button"
              className="btn card quiz-question__answer"
              onClick={() => handleAnswer(idx)}
              disabled={!canAnswer}
            >
              {ans}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default QuizQuestion
