import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuizGame } from '../games/quiz/QuizGameContext'
import { useBack } from '../hooks/useBack'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import './QuizResult.css'

function QuizResult() {
  const navigate = useNavigate()
  const { state, dispatch } = useQuizGame()

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

  const handleBack = useBack('/quiz/play')

  const isLastQuestion = state.currentQuestionIndex + 1 >= state.questionQueue.length
  const showMiniSummary = state.mode === 'room' && (state.questionsAnswered + 1) % 5 === 0 && !isLastQuestion

  return (
    <div className="quiz-result">
      <div className="quiz-result__top">
        <button type="button" className="btn btn--ghost quiz-result__back" onClick={handleBack}>
          ←
        </button>
        <HomeButton />
      </div>

      <div className="quiz-result__card card">
        <h2 className="quiz-result__correct">Правильный ответ</h2>
        <p className="quiz-result__answer">{question.answers[question.correctIndex]}</p>
      </div>

      <div className="quiz-result__scores">
        {state.players.map((p) => {
          const r = state.round[p.id]
          if (!r) return null
          return (
            <div key={p.id} className="quiz-result__player">
              <span className="quiz-result__player-name">{p.name}</span>
              <span className={r.isCorrect ? 'quiz-result__points--win' : 'quiz-result__points--lose'}>
                {r.isCorrect ? `+${r.pointsEarned}` : `-${r.pointsLost}`}
              </span>
              {p.streak > 0 && (
                <span className="quiz-result__streak">Стрик: {p.streak}</span>
              )}
            </div>
          )
        })}
      </div>

      <div className="quiz-result__actions">
        <button type="button" className="btn btn--primary quiz-result__next" onClick={handleNext}>
          {isLastQuestion ? 'Итоги' : showMiniSummary ? 'Мини-итог' : 'Далее'}
        </button>
      </div>
    </div>
  )
}

export default QuizResult
