import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuizGame } from '../games/quiz/QuizGameContext'
import { loadProgress, saveProgress, processDailyStreak, addScore, getLeague } from '../games/quiz/progress'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import './QuizFinal.css'

function QuizFinal() {
  const navigate = useNavigate()
  const { state, dispatch } = useQuizGame()

  const sorted = [...state.players].sort((a, b) => b.score - a.score)
  const totalScore = state.players.reduce((s, p) => s + p.score, 0)

  useEffect(() => {
    const prog = loadProgress()
    let next = addScore(prog, totalScore)
    const { progress } = processDailyStreak(next)
    saveProgress(progress)
  }, [totalScore])

  const handlePlayAgain = () => {
    hapticSelection()
    dispatch({ type: 'RESET' })
    navigate('/quiz')
  }

  const handleBack = () => {
    haptic('light')
    dispatch({ type: 'RESET' })
    navigate('/games')
  }

  const progress = loadProgress()
  const league = getLeague(progress.totalScore)

  return (
    <div className="quiz-final">
      <div className="quiz-final__top">
        <button type="button" className="btn btn--ghost quiz-final__back" onClick={handleBack}>
          ←
        </button>
        <HomeButton />
      </div>

      <h1 className="quiz-final__title">Игра окончена</h1>

      <div className="quiz-final__leaderboard card">
        <h2 className="quiz-final__leader-title">Итоги</h2>
        {sorted.map((p, i) => (
          <div key={p.id} className={`quiz-final__row ${i === 0 ? 'quiz-final__row--win' : ''}`}>
            <span className="quiz-final__rank">{i + 1}</span>
            <span className="quiz-final__name">{p.name}</span>
            <span className="quiz-final__score">{p.score}</span>
          </div>
        ))}
      </div>

      <div className="quiz-final__progress card">
        <p className="quiz-final__league">Лига: {league}</p>
        <p className="quiz-final__total">Всего очков: {progress.totalScore}</p>
        <p className="quiz-final__coins">Монеты: {progress.coins}</p>
      </div>

      <div className="quiz-final__actions">
        <button type="button" className="btn btn--primary quiz-final__btn" onClick={handlePlayAgain}>
          Сыграть снова
        </button>
        <button type="button" className="btn btn--ghost quiz-final__btn" onClick={handleBack}>
          Сменить тему
        </button>
      </div>
    </div>
  )
}

export default QuizFinal
