import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuizGame } from '../games/quiz/QuizGameContext'
import { getQuestionsByTags } from '../games/quiz/data/questions'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import './QuizRoomSetup.css'

const MIN_PLAYERS = 2
const MAX_PLAYERS = 8

function QuizRoomSetup() {
  const navigate = useNavigate()
  const { state, dispatch } = useQuizGame()
  const [count, setCount] = useState(4)
  const [names, setNames] = useState<string[]>(() => Array(4).fill(''))
  const [error, setError] = useState<string | null>(null)

  const updateCount = (n: number) => {
    hapticSelection()
    setCount(n)
    setError(null)
    setNames((prev) => {
      const next = [...prev]
      while (next.length < n) next.push('')
      return next.slice(0, n)
    })
  }

  const updateName = (i: number, v: string) => {
    setNames((prev) => {
      const next = [...prev]
      next[i] = v
      return next
    })
  }

  const handleStart = () => {
    const pool = getQuestionsByTags(state.selectedTags, 100)
    if (pool.length < state.totalQuestions) {
      setError(`Недостаточно вопросов по выбранным темам (нужно ${state.totalQuestions})`)
      return
    }
    const filled = names.slice(0, count).map((n, i) => n.trim() || `Игрок ${i + 1}`)
    if (filled.length < MIN_PLAYERS) return
    haptic('medium')
    dispatch({ type: 'SET_ROOM_PLAYERS', names: filled })
    navigate('/quiz/play')
  }

  const handleBack = () => {
    haptic('light')
    dispatch({ type: 'RESET' })
    if (window.history.length > 1) navigate(-1)
    else navigate('/quiz')
  }

  return (
    <div className="quiz-room-setup">
      <div className="quiz-room-setup__top">
        <HomeButton />
        <button type="button" className="btn btn--ghost home-btn quiz-room-setup__back" onClick={handleBack}>
          ← Назад
        </button>
      </div>
      <header className="quiz-room-setup__header">
        <h1 className="quiz-room-setup__title">Комната</h1>
        <p className="quiz-room-setup__tagline">{state.totalQuestions} вопросов</p>
      </header>

      <section className="quiz-room-setup__section">
        <h2 className="quiz-room-setup__section-title">Игроки</h2>
        <div className="quiz-room-setup__count-row">
          {Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i).map((n) => (
            <button
              key={n}
              type="button"
              className={`btn quiz-room-setup__count-btn ${count === n ? 'is-active' : ''}`}
              onClick={() => updateCount(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </section>

      <section className="quiz-room-setup__section">
        <h2 className="quiz-room-setup__section-title">Имена</h2>
        <div className="quiz-room-setup__names">
          {names.slice(0, count).map((name, i) => (
            <input
              key={i}
              type="text"
              className="quiz-room-setup__input card"
              placeholder={`Игрок ${i + 1}`}
              value={name}
              onChange={(e) => updateName(i, e.target.value)}
            />
          ))}
        </div>
      </section>

      {error && <p className="quiz-room-setup__error">{error}</p>}

      <div className="quiz-room-setup__actions">
        <button
          type="button"
          className="btn btn--primary quiz-room-setup__start"
          onClick={handleStart}
          disabled={count < MIN_PLAYERS}
        >
          Начать
        </button>
      </div>
    </div>
  )
}

export default QuizRoomSetup
