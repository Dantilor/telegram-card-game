import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuizGame } from '../games/quiz/QuizGameContext'
import { TAGS, TAG_LABELS } from '../games/quiz/types'
import { getQuestionsByTags } from '../games/quiz/data/questions'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import './QuizHome.css'

const QUESTION_COUNTS = [5, 10, 20] as const
type QuizMode = 'solo' | 'room'

function QuizHome() {
  const navigate = useNavigate()
  const { dispatch } = useQuizGame()
  const [mode, setMode] = useState<QuizMode>('solo')
  const [tags, setTags] = useState<string[]>([])
  const [questionCount, setQuestionCount] = useState(5)
  const [tagError, setTagError] = useState<string | null>(null)

  const toggleTag = (tag: string) => {
    hapticSelection()
    setTagError(null)
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const handleStart = () => {
    const pool = getQuestionsByTags(tags, 100)
    if (pool.length < questionCount) {
      setTagError(`По выбранным темам только ${pool.length} вопросов. Снимите фильтр или выберите меньше вопросов.`)
      return
    }
    haptic('medium')
    if (mode === 'solo') {
      dispatch({ type: 'START_SOLO', tags, totalQuestions: questionCount })
      navigate('/quiz/play')
    } else {
      dispatch({ type: 'START_ROOM', tags, totalQuestions: questionCount })
      navigate('/quiz/room')
    }
  }

  const handleBack = () => {
    haptic('light')
    navigate('/games')
  }

  return (
    <div className="quiz-home">
      <div className="quiz-home__top">
        <HomeButton />
        <button type="button" className="btn btn--ghost quiz-home__back" onClick={handleBack}>
          ← В меню
        </button>
      </div>
      <header className="quiz-home__header">
        <h1 className="quiz-home__title">Викторина</h1>
        <p className="quiz-home__tagline">Ставки + Стрики + Дуэли</p>
      </header>

      <section className="quiz-home__section">
        <h2 className="quiz-home__section-title">Режим</h2>
        <div className="quiz-home__mode-row">
          <button
            type="button"
            className={`btn quiz-home__mode-btn ${mode === 'solo' ? 'is-active' : ''}`}
            onClick={() => { hapticSelection(); setMode('solo') }}
          >
            Одиночный
          </button>
          <button
            type="button"
            className={`btn quiz-home__mode-btn ${mode === 'room' ? 'is-active' : ''}`}
            onClick={() => { hapticSelection(); setMode('room') }}
          >
            Комната
          </button>
        </div>
      </section>

      <section className="quiz-home__section">
        <h2 className="quiz-home__section-title">Вопросов</h2>
        <div className="quiz-home__count-row">
          {QUESTION_COUNTS.map((n) => (
            <button
              key={n}
              type="button"
              className={`btn quiz-home__count-btn ${questionCount === n ? 'is-active' : ''}`}
              onClick={() => { hapticSelection(); setQuestionCount(n) }}
            >
              {n}
            </button>
          ))}
        </div>
      </section>

      <section className="quiz-home__section">
        <h2 className="quiz-home__section-title">Тема (опционально)</h2>
        <div className="quiz-home__tags">
          {TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`btn quiz-home__tag-btn ${tags.includes(tag) ? 'is-active' : ''}`}
              onClick={() => toggleTag(tag)}
            >
              {TAG_LABELS[tag]}
            </button>
          ))}
        </div>
      </section>

      {tagError && (
        <p className="quiz-home__error">{tagError}</p>
      )}

      <div className="quiz-home__actions">
        <button
          type="button"
          className="btn btn--primary quiz-home__start"
          onClick={handleStart}
        >
          {mode === 'solo' ? 'Начать' : 'Далее'}
        </button>
      </div>
    </div>
  )
}

export default QuizHome
