import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuizGame } from '../games/quiz/QuizGameContext'
import { TAGS, TAG_LABELS, TAG_EMOJIS } from '../games/quiz/types'
import { getQuestionsByTags } from '../games/quiz/data/questions'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import './QuizHome.css'

const QUESTION_COUNTS = [5, 10, 20] as const
const PARTICIPANT_COUNT_OPTIONS = [2, 3, 4, 5, 6, 7, 8] as const

function QuizHome() {
  const navigate = useNavigate()
  const location = useLocation()
  const { state, dispatch } = useQuizGame()
  const [tags, setTags] = useState<string[]>([])
  const [questionCount, setQuestionCount] = useState(5)
  const [tagError, setTagError] = useState<string | null>(null)
  const [showExitConfirm, setShowExitConfirm] = useState<'back' | 'home' | null>(null)

  const [participantCount, setParticipantCount] = useState(2)
  const [names, setNames] = useState<string[]>(() => Array(8).fill(''))
  const startRequestedRef = useRef(false)

  useEffect(() => {
    if (state.phase === 'question' && location.pathname === '/quiz' && startRequestedRef.current) {
      startRequestedRef.current = false
      navigate('/quiz/play', { replace: true })
    }
  }, [state.phase, location.pathname, navigate])

  useEffect(() => {
    if (state.phase === 'setup') {
      setTags([])
      setQuestionCount(5)
      setTagError(null)
      setParticipantCount(2)
      setNames(Array(8).fill(''))
      setShowExitConfirm(null)
    }
  }, [state.phase])

  const toggleTag = (tag: string) => {
    hapticSelection()
    setTagError(null)
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const handleParticipantCount = (count: number) => {
    hapticSelection()
    setParticipantCount(count)
  }

  const handleName = (index: number, value: string) => {
    setNames((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  const visibleNames = names.slice(0, participantCount)
  const canStart =
    tags.length >= 1 &&
    participantCount >= 2

  const validationHint: string | null = canStart
    ? null
    : tags.length === 0
      ? null
      : 'Выберите минимум одну категорию и укажите участников'

  const handleStart = () => {
    const pool = getQuestionsByTags(tags, 100)
    if (pool.length < questionCount) {
      setTagError(`По выбранным темам только ${pool.length} вопросов. Выберите другие категории.`)
      return
    }
    if (!canStart) return

    haptic('medium')
    startRequestedRef.current = true

    const playerNames = visibleNames.map((n, i) => n.trim() || `Игрок ${i + 1}`)
    dispatch({ type: 'START_ROOM', tags, totalQuestions: questionCount })
    dispatch({ type: 'SET_ROOM_PLAYERS', names: playerNames })
  }

  const hasData = tags.length > 0 || names.some((n) => n.trim() !== '')

  const handleBackClick = () => {
    if (hasData) {
      setShowExitConfirm('back')
    } else {
      dispatch({ type: 'RESET' })
      navigate('/games')
    }
  }

  const handleExitConfirm = (confirmed: boolean) => {
    const target = showExitConfirm
    setShowExitConfirm(null)
    if (!confirmed) return
    haptic('light')
    dispatch({ type: 'RESET' })
    if (target === 'home') {
      navigate('/')
    } else {
      navigate('/games')
    }
  }

  const handleTapOutside = (e: React.PointerEvent) => {
    const target = e.target
    if (!(target instanceof HTMLElement)) return
    const tag = target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return
    const active = document.activeElement
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      ;(active as HTMLElement).blur()
    }
  }

  return (
    <div className="quiz-home" onPointerDown={handleTapOutside}>
      <div className="quiz-home__top">
        <HomeButton
          onBeforeNavigate={() => {
            if (hasData) {
              setShowExitConfirm('home')
              return true
            }
            dispatch({ type: 'RESET' })
            return false
          }}
        />
        <button type="button" className="btn btn--ghost quiz-home__back" onClick={handleBackClick}>
          ← Назад
        </button>
      </div>
      <header className="quiz-home__header">
        <h1 className="quiz-home__title">Битва умов</h1>
        <p className="quiz-home__tagline">Ставка сделана. Ответишь правильно?</p>
        <div className="quiz-home__how card">
          <h3 className="quiz-home__how-title">Как играть?</h3>
          <ul className="quiz-home__how-list">
            <li>Отвечай на вопросы выбранной темы.</li>
            <li>За верный ответ — баллы.</li>
            <li>Побеждает тот, кто набрал больше.</li>
          </ul>
        </div>
      </header>

      <section className="quiz-home__section">
        <h2 className="quiz-home__section-title">Количество участников</h2>
        <div className="quiz-home__options">
          {PARTICIPANT_COUNT_OPTIONS.map((count) => (
            <button
              key={count}
              type="button"
              className={`btn btn--ghost quiz-home__option-btn ${participantCount === count ? 'quiz-home__option-btn--active' : ''}`}
              onClick={() => handleParticipantCount(count)}
            >
              {count}
            </button>
          ))}
        </div>
      </section>

      <section className="quiz-home__section">
        <h2 className="quiz-home__section-title">Количество вопросов</h2>
        <div className="quiz-home__options">
          {QUESTION_COUNTS.map((n) => (
            <button
              key={n}
              type="button"
              className={`btn btn--ghost quiz-home__option-btn ${questionCount === n ? 'quiz-home__option-btn--active' : ''}`}
              onClick={() => { hapticSelection(); setQuestionCount(n) }}
            >
              {n}
            </button>
          ))}
        </div>
      </section>

      <section className="quiz-home__section">
        <h2 className="quiz-home__section-title">Категории <span className="quiz-home__section-hint">(выберите одну или несколько)</span></h2>
        {tags.length === 0 && (
          <p className="quiz-home__category-hint" role="status">Выберите минимум одну категорию</p>
        )}
        <div className="quiz-home__categories">
          {TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`quiz-home__category-card card ${tags.includes(tag) ? 'quiz-home__category-card--active' : ''}`}
              onClick={() => toggleTag(tag)}
            >
              <span className="quiz-home__category-emoji" aria-hidden>{TAG_EMOJIS[tag]}</span>
              <span className="quiz-home__category-title">{TAG_LABELS[tag]}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="quiz-home__section quiz-home__section--participants">
        <h2 className="quiz-home__participants-title">Введите имена участников</h2>
        <div className="quiz-home__participants-list">
          {Array.from({ length: participantCount }, (_, i) => (
            <input
              key={i}
              type="text"
              className="quiz-home__name-input card"
              placeholder={`Игрок ${i + 1}`}
              value={names[i] ?? ''}
              onChange={(e) => handleName(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              }}
              inputMode="text"
              enterKeyHint="done"
              autoCorrect="off"
              autoCapitalize="words"
              maxLength={32}
            />
          ))}
        </div>
      </section>

      {tagError && (
        <p className="quiz-home__error">{tagError}</p>
      )}

      <div className="quiz-home__actions">
        {validationHint != null && (
          <p className="quiz-home__hint-text" role="status">{validationHint}</p>
        )}
        <button
          type="button"
          className="btn btn--primary quiz-home__start"
          disabled={!canStart}
          onClick={handleStart}
        >
          Начать раунд
        </button>
      </div>

      {showExitConfirm != null && (
        <div
          className="quiz-home__modal-overlay"
          onClick={() => handleExitConfirm(false)}
        >
          <div className="quiz-home__modal card" onClick={(e) => e.stopPropagation()}>
            <p className="quiz-home__modal-text">Выйти из игры?</p>
            <p className="quiz-home__modal-hint">
              Если выйти, все настройки будут сброшены.
            </p>
            <div className="quiz-home__modal-buttons">
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

export default QuizHome
