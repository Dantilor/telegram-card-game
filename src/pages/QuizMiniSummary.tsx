import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuizGame } from '../games/quiz/QuizGameContext'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
import GameExitConfirmModal from '../components/GameExitConfirmModal'
import './QuizMiniSummary.css'

function QuizMiniSummary() {
  const navigate = useNavigate()
  const { state, dispatch } = useQuizGame()
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  const sorted = [...state.players].sort((a, b) => {
    if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount
    return b.score - a.score
  })
  const leader = sorted[0]

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
    <div className="game-page quiz-mini-summary">
      <div className="game-page__top">
        <HomeButton className="game-page__nav-btn" onBeforeNavigate={handleHomeClick} />
        <BackButton onClick={handleBack} className="game-page__nav-btn game-page__back" />
      </div>

      <h1 className="quiz-mini-summary__title">Мини-итог</h1>
      <p className="quiz-mini-summary__subtitle">После {state.questionsAnswered} вопросов</p>
      {leader && (
        <p className="quiz-mini-summary__leader-label">В лидерах: {leader.name}</p>
      )}

      <div className="quiz-mini-summary__leaderboard game-page__panel game-page__panel--glow-a">
        {sorted.map((p, i) => (
          <div key={p.id} className={`quiz-mini-summary__row ${i === 0 ? 'quiz-mini-summary__row--leader' : ''}`}>
            <span className="quiz-mini-summary__rank">{i + 1}</span>
            <span className="quiz-mini-summary__name">{p.name}</span>
            <span className="quiz-mini-summary__correct">{p.correctCount} верно</span>
            <span className="quiz-mini-summary__wrong">{p.wrongCount} неверно</span>
            <span className="quiz-mini-summary__score">{p.score}</span>
          </div>
        ))}
      </div>

      <div className="quiz-mini-summary__actions">
        <button type="button" className="game-page__cta" onClick={handleContinue}>
          Продолжить игру
        </button>
        <button type="button" className="game-page__btn game-page__btn--secondary" onClick={handleBack}>
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

export default QuizMiniSummary
