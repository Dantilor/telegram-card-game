import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuizGame } from '../games/quiz/QuizGameContext'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import './QuizMiniSummary.css'

function QuizMiniSummary() {
  const navigate = useNavigate()
  const { state, dispatch } = useQuizGame()
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  const sorted = [...state.players].sort((a, b) => b.score - a.score)

  const handleContinue = () => {
    hapticSelection()
    dispatch({ type: 'CONTINUE_5' })
    navigate('/quiz/play')
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

  return (
    <div className="quiz-mini-summary">
      <div className="quiz-mini-summary__top">
        <button type="button" className="btn btn--ghost quiz-mini-summary__back" onClick={handleBack}>
          ←
        </button>
        <HomeButton onBeforeNavigate={handleHomeClick} />
      </div>

      <h1 className="quiz-mini-summary__title">Мини-итог</h1>
      <p className="quiz-mini-summary__subtitle">После {state.questionsAnswered} вопросов</p>

      <div className="quiz-mini-summary__leaderboard card">
        {sorted.map((p, i) => (
          <div key={p.id} className={`quiz-mini-summary__row ${i === 0 ? 'quiz-mini-summary__row--leader' : ''}`}>
            <span className="quiz-mini-summary__rank">{i + 1}</span>
            <span className="quiz-mini-summary__name">{p.name}</span>
            <span className="quiz-mini-summary__score">{p.score}</span>
          </div>
        ))}
      </div>

      <div className="quiz-mini-summary__actions">
        <button type="button" className="btn btn--primary quiz-mini-summary__btn" onClick={handleContinue}>
          Продолжить игру
        </button>
        <button type="button" className="btn btn--ghost quiz-mini-summary__btn" onClick={handleBack}>
          Выйти из игры
        </button>
      </div>

      {showExitConfirm && (
        <div className="quiz-mini-summary__modal-overlay" onClick={() => handleExitConfirm(false)}>
          <div className="quiz-mini-summary__modal card" onClick={(e) => e.stopPropagation()}>
            <p className="quiz-mini-summary__modal-text">Выйти из игры?</p>
            <p className="quiz-mini-summary__modal-hint">
              Если выйти, весь прогресс будет сброшен.
            </p>
            <div className="quiz-mini-summary__modal-btns">
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

export default QuizMiniSummary
