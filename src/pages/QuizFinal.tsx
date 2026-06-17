import { useNavigate } from 'react-router-dom'
import { useQuizGame } from '../games/quiz/QuizGameContext'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import './QuizFinal.css'

function QuizFinal() {
  const navigate = useNavigate()
  const { state, dispatch } = useQuizGame()

  const sorted = [...state.players].sort((a, b) => {
    if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount
    return b.score - a.score
  })
  const winner = sorted[0]

  const handlePlayAgain = () => {
    hapticSelection()
    dispatch({ type: 'RESET' })
    navigate('/quiz')
  }

  const handleBackToMenu = () => {
    haptic('light')
    dispatch({ type: 'RESET' })
    navigate('/games')
  }

  const handleHomeClick = () => {
    dispatch({ type: 'RESET' })
    return false
  }

  return (
    <div className="game-page quiz-final game-page--enter">
      <div className="game-page__top game-page__top--solo">
        <HomeButton className="game-page__nav-btn" onBeforeNavigate={handleHomeClick} />
      </div>

      <header className="quiz-final__header">
        <h1 className="quiz-final__title">Игра окончена!</h1>
        {winner && (winner.correctCount > 0 || winner.score > 0) && (
          <div className="quiz-final__winner">
            <span className="quiz-final__winner-label">Победитель</span>
            <span className="quiz-final__winner-name">{winner.name}</span>
            <span className="quiz-final__winner-score">{winner.correctCount} верно · {winner.score} очков</span>
          </div>
        )}
      </header>

      <section className="quiz-final__scores">
        <h2 className="quiz-final__scores-title">Результаты</h2>
        <div className="quiz-final__scores-list">
          {sorted.map((p, i) => (
            <div
              key={p.id}
              className={`quiz-final__row game-page__panel game-page__panel--glow-a ${i === 0 ? 'quiz-final__row--winner' : ''}`}
            >
              <span className="quiz-final__rank">{i + 1}</span>
              <span className="quiz-final__name">{p.name}</span>
              <span className="quiz-final__correct">{p.correctCount} верно</span>
              <span className="quiz-final__wrong">{p.wrongCount} неверно</span>
              <span className="quiz-final__score">{p.score}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="quiz-final__actions">
        <button type="button" className="game-page__cta" onClick={handlePlayAgain}>
          Играть ещё
        </button>
        <button type="button" className="game-page__btn game-page__btn--secondary" onClick={handleBackToMenu}>
          Назад в меню
        </button>
      </div>
    </div>
  )
}

export default QuizFinal
