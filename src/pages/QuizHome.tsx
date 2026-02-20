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
const TEAM_COUNT_OPTIONS = [2, 3, 4, 5, 6] as const

type TeamSlot = {
  name: string
  players: string[]
}

function QuizHome() {
  const navigate = useNavigate()
  const location = useLocation()
  const { state, dispatch } = useQuizGame()
  const [tags, setTags] = useState<string[]>([])
  const [questionCount, setQuestionCount] = useState(5)
  const [tagError, setTagError] = useState<string | null>(null)
  const [showExitConfirm, setShowExitConfirm] = useState<'back' | 'home' | null>(null)
  
  const [teamCount, setTeamCount] = useState(2)
  const [teams, setTeams] = useState<TeamSlot[]>(() => 
    Array.from({ length: 6 }, () => ({ name: '', players: [] }))
  )
  const [playerInputs, setPlayerInputs] = useState<string[]>(() => Array(6).fill(''))
  const playerInputRefs = useRef<(HTMLInputElement | null)[]>([])
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
      setTeamCount(2)
      setTeams(Array.from({ length: 6 }, () => ({ name: '', players: [] })))
      setPlayerInputs(Array(6).fill(''))
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

  const handleTeamCount = (count: number) => {
    hapticSelection()
    setTeamCount(count)
  }

  const handleTeamName = (slotIndex: number, name: string) => {
    setTeams((prev) => {
      const next = [...prev]
      next[slotIndex] = { ...next[slotIndex]!, name }
      return next
    })
  }

  const handleAddPlayer = (slotIndex: number) => {
    const name = (playerInputs[slotIndex] ?? '').trim()
    if (!name) return
    hapticSelection()
    setTeams((prev) => {
      const next = [...prev]
      next[slotIndex] = { 
        ...next[slotIndex]!, 
        players: [...next[slotIndex]!.players, name] 
      }
      return next
    })
    setPlayerInputs((prev) => {
      const next = [...prev]
      next[slotIndex] = ''
      return next
    })
    playerInputRefs.current[slotIndex]?.blur()
  }

  const handleRemovePlayer = (slotIndex: number, playerIndex: number) => {
    haptic('light')
    setTeams((prev) => {
      const next = [...prev]
      next[slotIndex] = {
        ...next[slotIndex]!,
        players: next[slotIndex]!.players.filter((_, i) => i !== playerIndex),
      }
      return next
    })
  }

  const canStart =
    tags.length >= 1 &&
    Array.from({ length: teamCount }, (_, i) => teams[i]).every(
      (t) => t && t.name.trim() !== '' && t.players.length >= 2
    )

  const validationHint: string | null = canStart
    ? null
    : tags.length === 0
      ? 'Выберите минимум одну категорию'
      : (() => {
          for (let i = 0; i < teamCount; i++) {
            const t = teams[i]
            if (!t || t.name.trim() === '') return `Укажите название команды ${i + 1}`
            if (t.players.length < 2) return `Добавьте минимум 2 игроков в команду «${t.name.trim() || i + 1}»`
          }
          return null
        })()

  const handleStart = () => {
    const pool = getQuestionsByTags(tags, 100)
    if (pool.length < questionCount) {
      setTagError(`По выбранным темам только ${pool.length} вопросов. Выберите другие категории.`)
      return
    }
    if (!canStart) return
    
    haptic('medium')
    startRequestedRef.current = true
    
    const playerNames: string[] = []
    for (let i = 0; i < teamCount; i++) {
      const team = teams[i]
      if (team) {
        team.players.forEach((p) => {
          playerNames.push(`${team.name}: ${p}`)
        })
      }
    }
    
    dispatch({ type: 'START_ROOM', tags, totalQuestions: questionCount })
    dispatch({ type: 'SET_ROOM_PLAYERS', names: playerNames })
  }

  const hasData = tags.length > 0 || teams.some((t) => t.name.trim() || t.players.length > 0)

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

  const visibleTeams = teams.slice(0, teamCount)

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
        <h1 className="quiz-home__title">Викторина</h1>
        <div className="quiz-home__rules-box">
          <p className="quiz-home__rules">
            Отвечай на вопросы выбранной темы. За верный ответ — баллы. 
            Знания решают. Ошибки наказываются.
          </p>
        </div>
      </header>

      <section className="quiz-home__section">
        <h2 className="quiz-home__section-title">Количество команд</h2>
        <div className="quiz-home__options">
          {TEAM_COUNT_OPTIONS.map((count) => (
            <button
              key={count}
              type="button"
              className={`btn btn--ghost quiz-home__option-btn ${teamCount === count ? 'quiz-home__option-btn--active' : ''}`}
              onClick={() => handleTeamCount(count)}
            >
              {count}
            </button>
          ))}
        </div>
      </section>

      <section className="quiz-home__section">
        <h2 className="quiz-home__section-title">Вопросов</h2>
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
        <div className="quiz-home__categories">
          {TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`quiz-home__category-card card ${tags.includes(tag) ? 'quiz-home__category-card--active' : ''}`}
              onClick={() => toggleTag(tag)}
            >
              <span className="quiz-home__category-emoji">{TAG_EMOJIS[tag]}</span>
              <span className="quiz-home__category-title">{TAG_LABELS[tag]}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="quiz-home__section quiz-home__section--teams">
        <h2 className="quiz-home__teams-title">Команды</h2>
        <div className="quiz-home__teams-list">
          {visibleTeams.map((team, slotIndex) => (
            <div key={slotIndex} className="quiz-home__team-card card">
              <label className="quiz-home__team-label">Название команды</label>
              <input
                type="text"
                className="quiz-home__team-input"
                placeholder={`Команда ${slotIndex + 1}`}
                value={team.name}
                onChange={(e) => handleTeamName(slotIndex, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    ;(e.target as HTMLInputElement).blur()
                  }
                }}
                inputMode="text"
                enterKeyHint="done"
                autoCorrect="off"
                autoCapitalize="words"
                maxLength={32}
              />
              <div className="quiz-home__team-players">
                <span className="quiz-home__players-label">
                  Игроки {team.players.length < 2 && <span className="quiz-home__hint">(минимум 2)</span>}
                </span>
                <ul className="quiz-home__player-list">
                  {team.players.map((playerName, playerIndex) => (
                    <li key={playerIndex} className="quiz-home__player-item">
                      <span className="quiz-home__player-name">{playerName}</span>
                      <button
                        type="button"
                        className="btn btn--ghost quiz-home__player-remove"
                        onClick={() => handleRemovePlayer(slotIndex, playerIndex)}
                        aria-label="Удалить"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="quiz-home__add-row">
                  <input
                    ref={(el) => {
                      playerInputRefs.current[slotIndex] = el
                    }}
                    type="text"
                    className="quiz-home__team-input quiz-home__team-input--small"
                    placeholder="Имя игрока"
                    value={playerInputs[slotIndex] ?? ''}
                    onChange={(e) => {
                      setPlayerInputs((prev) => {
                        const next = [...prev]
                        next[slotIndex] = e.target.value
                        return next
                      })
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddPlayer(slotIndex)
                      }
                    }}
                    inputMode="text"
                    enterKeyHint="done"
                    autoCorrect="off"
                    autoCapitalize="words"
                  />
                  <button
                    type="button"
                    className="btn btn--secondary quiz-home__add-btn"
                    onClick={() => handleAddPlayer(slotIndex)}
                  >
                    Добавить
                  </button>
                </div>
              </div>
            </div>
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
          Начать игру
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
