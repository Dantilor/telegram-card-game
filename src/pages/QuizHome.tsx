import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuizGame } from '../games/quiz/QuizGameContext'
import { TAGS, TAG_LABELS, TAG_EMOJIS } from '../games/quiz/types'
import { getQuestionsByTags } from '../games/quiz/data/questions'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
import GamesPageHeader from '../components/GamesPageHeader'
import GameExitConfirmModal from '../components/GameExitConfirmModal'
import PremiumOverlay from '../components/PremiumOverlay'
import { useGameStartGate } from '../hooks/useGameStartGate'
import './QuizHome.css'

const QUESTION_COUNTS = [5, 10, 20] as const
const TIME_PER_QUESTION_OPTIONS = [30, 60, 120] as const
const PARTICIPANT_COUNT_OPTIONS = [2, 3, 4, 5, 6, 7, 8] as const

function QuizHome() {
  const navigate = useNavigate()
  const location = useLocation()
  const { state, dispatch } = useQuizGame()
  const [tags, setTags] = useState<string[]>([])
  const [questionCount, setQuestionCount] = useState(5)
  const [timePerQuestion, setTimePerQuestion] = useState(60)
  const [tagError, setTagError] = useState<string | null>(null)
  const [showExitConfirm, setShowExitConfirm] = useState<'back' | 'home' | null>(null)

  const [participantCount, setParticipantCount] = useState(2)
  const [names, setNames] = useState<string[]>(() => Array(8).fill(''))
  const startRequestedRef = useRef(false)
  const { startLocked, premiumOverlayOpen, closePremiumOverlay, gatedStart, startCtaClassName } =
    useGameStartGate('quiz')

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
      setTimePerQuestion(60)
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
    const pool = getQuestionsByTags(tags, questionCount)
    if (pool.length < questionCount) {
      setTagError(`По выбранным темам только ${pool.length} вопросов. Выберите другие категории или меньше вопросов.`)
      return
    }
    if (!canStart) return

    haptic('medium')
    startRequestedRef.current = true

    const playerNames = visibleNames.map((n, i) => n.trim() || `Игрок ${i + 1}`)
    dispatch({ type: 'START_ROOM', tags, totalQuestions: questionCount, timePerQuestionSec: timePerQuestion })
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
    <div className="game-page quiz-home game-page--enter" onPointerDown={handleTapOutside}>
      <div className="game-page__top">
        <HomeButton
          className="game-page__nav-btn"
          onBeforeNavigate={() => {
            if (hasData) {
              setShowExitConfirm('home')
              return true
            }
            dispatch({ type: 'RESET' })
            return false
          }}
        />
        <BackButton onClick={handleBackClick} className="game-page__nav-btn game-page__back" />
      </div>

      <GamesPageHeader
        title="Битва умов"
        tagline="Ставка сделана. Ответишь правильно?"
      />

      <div className="quiz-home__how game-page__panel game-page__panel--glow-b">
        <h3 className="quiz-home__how-title">Как играть?</h3>
        <ul className="quiz-home__how-list">
          <li>Отвечай на вопросы выбранной темы.</li>
          <li>За верный ответ — баллы.</li>
          <li>Побеждает тот, кто набрал больше.</li>
        </ul>
      </div>

      <section className="quiz-home__section game-page__section">
        <h2 className="game-page__section-title">Количество участников</h2>
        <div className="game-page__chip-row">
          {PARTICIPANT_COUNT_OPTIONS.map((count) => (
            <button
              key={count}
              type="button"
              className={`game-page__chip ${participantCount === count ? 'is-active' : ''}`}
              onClick={() => handleParticipantCount(count)}
            >
              {count}
            </button>
          ))}
        </div>
      </section>

      <section className="quiz-home__section game-page__section">
        <h2 className="game-page__section-title">Количество вопросов</h2>
        <div className="game-page__chip-row">
          {QUESTION_COUNTS.map((n) => (
            <button
              key={n}
              type="button"
              className={`game-page__chip ${questionCount === n ? 'is-active' : ''}`}
              onClick={() => { hapticSelection(); setQuestionCount(n) }}
            >
              {n}
            </button>
          ))}
        </div>
      </section>

      <section className="quiz-home__section game-page__section">
        <h2 className="game-page__section-title">Время на задание</h2>
        <div className="game-page__chip-row">
          {TIME_PER_QUESTION_OPTIONS.map((sec) => (
            <button
              key={sec}
              type="button"
              className={`game-page__chip game-page__chip--wide ${timePerQuestion === sec ? 'is-active' : ''}`}
              onClick={() => { hapticSelection(); setTimePerQuestion(sec) }}
            >
              {sec} сек
            </button>
          ))}
        </div>
      </section>

      <section className="quiz-home__section game-page__section">
        <h2 className="game-page__section-title">
          Категории <span className="quiz-home__section-hint">(выберите одну или несколько)</span>
        </h2>
        {tags.length === 0 && (
          <p className="quiz-home__category-hint" role="status">Выберите минимум одну категорию</p>
        )}
        <div className="quiz-home__categories">
          {TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`quiz-home__category-card game-page__panel game-page__panel--glow-a game-page__category-card ${tags.includes(tag) ? 'is-active' : ''}`}
              onClick={() => toggleTag(tag)}
            >
              <span className="quiz-home__category-emoji" aria-hidden>{TAG_EMOJIS[tag]}</span>
              <span className="quiz-home__category-title game-page__category-title">{TAG_LABELS[tag]}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="quiz-home__section quiz-home__section--participants game-page__section">
        <h2 className="game-page__section-title">Введите имена участников</h2>
        <div className="quiz-home__participants-list">
          {Array.from({ length: participantCount }, (_, i) => (
            <input
              key={i}
              type="text"
              className="game-page__input"
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

      <div className="game-page__actions">
        {validationHint != null && (
          <p className="game-page__hint" role="status">{validationHint}</p>
        )}
        <button
          type="button"
          className={startCtaClassName}
          disabled={!startLocked && !canStart}
          onClick={() => gatedStart(handleStart)}
        >
          Начать раунд
        </button>
      </div>

      <PremiumOverlay isOpen={premiumOverlayOpen} onClose={closePremiumOverlay} />

      {showExitConfirm != null && (
        <GameExitConfirmModal
          hint="Если выйти, все настройки будут сброшены."
          onCancel={() => handleExitConfirm(false)}
          onConfirm={() => handleExitConfirm(true)}
        />
      )}
    </div>
  )
}

export default QuizHome
