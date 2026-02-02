import { useNavigate } from 'react-router-dom'
import { useQuizGame } from '../games/quiz/QuizGameContext'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import './QuizMiniSummary.css'

function QuizMiniSummary() {
  const navigate = useNavigate()
  const { state, dispatch } = useQuizGame()

  const sorted = [...state.players].sort((a, b) => b.score - a.score)

  const handleRevenge = () => {
    hapticSelection()
    dispatch({ type: 'REVENGE' })
    navigate('/quiz/play')
  }

  const handleContinue = () => {
    hapticSelection()
    dispatch({ type: 'CONTINUE_5' })
    navigate('/quiz/play')
  }

  const handleBack = () => {
    haptic('light')
    navigate('/quiz')
  }

  return (
    <div className="quiz-mini-summary">
      <div className="quiz-mini-summary__top">
        <button type="button" className="btn btn--ghost quiz-mini-summary__back" onClick={handleBack}>
          ←
        </button>
        <HomeButton />
      </div>

      <h1 className="quiz-mini-summary__title">Мини-итог</h1>
      <p className="quiz-mini-summary__subtitle">После 5 вопросов</p>

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
        <button type="button" className="btn btn--primary quiz-mini-summary__btn" onClick={handleRevenge}>
          Реванш
        </button>
        <button type="button" className="btn btn--secondary quiz-mini-summary__btn" onClick={handleContinue}>
          Ещё 5 вопросов
        </button>
      </div>
    </div>
  )
}

export default QuizMiniSummary
