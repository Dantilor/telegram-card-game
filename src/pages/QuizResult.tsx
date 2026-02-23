import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuizGame } from '../games/quiz/QuizGameContext'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import './QuizResult.css'

function QuizResult() {
  const navigate = useNavigate()
  const { state, dispatch } = useQuizGame()
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  const question = state.questionQueue[state.currentQuestionIndex]

  useEffect(() => {
    if (state.phase === 'mini_summary') navigate('/quiz/mini-summary')
    else if (state.phase === 'final') navigate('/quiz/final')
    else if (state.phase === 'question') navigate('/quiz/play')
  }, [state.phase, navigate])

  if (!question) {
    navigate('/quiz')
    return null
  }

  const handleNext = () => {
    hapticSelection()
    dispatch({ type: 'NEXT_QUESTION' })
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

  const isLastQuestion = state.currentQuestionIndex + 1 >= state.questionQueue.length

  return (
    <div className="quiz-result">
      <div className="quiz-result__top">
        <button type="button" className="btn btn--ghost home-btn quiz-result__back" onClick={handleBack}>
          ←
        </button>
        <HomeButton onBeforeNavigate={handleHomeClick} />
      </div>

      <header className="quiz-result__header">
        <h1 className="quiz-result__title">Результаты</h1>
        <p className="quiz-result__question-num">Вопрос {state.currentQuestionIndex + 1}</p>
      </header>

      <div className="quiz-result__scores card">
        {state.players.map((p) => {
          const r = state.round[p.id]
          if (!r) return null
          return (
            <div key={p.id} className={`quiz-result__player ${r.isCorrect ? 'quiz-result__player--correct' : 'quiz-result__player--wrong'}`}>
              <span className="quiz-result__player-name">{p.name}</span>
              <span className={`quiz-result__points ${r.isCorrect ? 'quiz-result__points--win' : 'quiz-result__points--lose'}`}>
                {r.isCorrect ? `+${r.pointsEarned}` : r.pointsLost > 0 ? `-${r.pointsLost}` : '0'}
              </span>
              <span className="quiz-result__status">
                {r.isCorrect ? '✓' : '✗'}
              </span>
            </div>
          )
        })}
      </div>

      <div className="quiz-result__total card">
        <h2 className="quiz-result__total-title">Текущий счёт</h2>
        <div className="quiz-result__total-list">
          {[...state.players].sort((a, b) => b.score - a.score).map((p, i) => (
            <div key={p.id} className="quiz-result__total-row">
              <span className="quiz-result__total-rank">{i + 1}</span>
              <span className="quiz-result__total-name">{p.name}</span>
              <span className="quiz-result__total-score">{p.score}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="quiz-result__actions">
        <button type="button" className="btn btn--primary quiz-result__next" onClick={handleNext}>
          {isLastQuestion ? 'Показать итоги' : 'Следующий вопрос'}
        </button>
      </div>

      {showExitConfirm && (
        <div className="quiz-result__modal-overlay" onClick={() => handleExitConfirm(false)}>
          <div className="quiz-result__modal card" onClick={(e) => e.stopPropagation()}>
            <p className="quiz-result__modal-text">Выйти из игры?</p>
            <p className="quiz-result__modal-hint">
              Если выйти, весь прогресс будет сброшен.
            </p>
            <div className="quiz-result__modal-btns">
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

export default QuizResult
