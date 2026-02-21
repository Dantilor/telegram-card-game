import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useActivityStateContext } from '../games/activity/ActivityStateContext'
import { saveActivityState, getInitialActivityState } from '../games/activity/state'
import { ACTIVITY_CATEGORIES, type ActivityCategoryId } from '../games/activity/data/activityWords'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import { ActivityTeamsSetup } from '../components/activity/ActivityTeamsSetup'
import './ActivityHome.css'

const TEAM_COUNT_OPTIONS = [2, 3, 4, 5, 6] as const
const TIMER_OPTIONS = [30, 45, 60] as const

function ActivityHome() {
  const navigate = useNavigate()
  const location = useLocation()
  const { state, dispatch } = useActivityStateContext()
  const [showExitConfirm, setShowExitConfirm] = useState<'back' | 'home' | null>(null)
  const startRequestedRef = useRef(false)

  const goToGames = () => {
    haptic('light')
    navigate('/games')
  }

  useEffect(() => {
    if (state.phase === 'turn_ready' && location.pathname === '/activity' && startRequestedRef.current) {
      startRequestedRef.current = false
      saveActivityState(state)
      navigate('/activity/play', { replace: true })
    }
  }, [state.phase, location.pathname, navigate, state])

  const teamCount = state.teamCount
  const teams = state.teams

  const hasNamesOrPlayers = state.teams.some(
    (t) => t.name.trim() !== '' || t.players.length > 0
  )
  const hasScores = state.teamScores.some((s) => s > 0)
  const dirty =
    teamCount !== 2 ||
    state.timerSeconds !== 60 ||
    state.categoryIds.length > 0 ||
    hasNamesOrPlayers ||
    state.phase !== 'setup' ||
    hasScores

  const canStart =
    state.categoryIds.length >= 1 &&
    Array.from({ length: teamCount }, (_, i) => teams[i]).every(
      (t) => t && t.name.trim() !== '' && t.players.length >= 2
    )

  const validationHint: string | null = canStart
    ? null
    : state.categoryIds.length === 0
      ? 'Выберите минимум одну категорию'
      : (() => {
          for (let i = 0; i < teamCount; i++) {
            const t = teams[i]
            if (!t || t.name.trim() === '') return `Укажите название команды ${i + 1}`
            if (t.players.length < 2) return `Добавьте минимум двух игроков в команду «${t.name.trim() || i + 1}»`
          }
          return null
        })()

  const handleCategoryClick = (categoryId: ActivityCategoryId) => {
    hapticSelection()
    const nextIds = state.categoryIds.includes(categoryId)
      ? state.categoryIds.filter((id) => id !== categoryId)
      : [...state.categoryIds, categoryId]
    dispatch({ type: 'SET_CATEGORY_IDS', categoryIds: nextIds })
  }

  const handleTeamCount = (count: number) => {
    hapticSelection()
    dispatch({ type: 'SET_TEAM_COUNT', count })
  }

  const handleTimer = (seconds: 30 | 45 | 60) => {
    hapticSelection()
    dispatch({ type: 'SET_TIMER', seconds })
  }

  const handleStartGame = () => {
    if (!canStart) return
    haptic('medium')
    startRequestedRef.current = true
    dispatch({ type: 'START_GAME' })
  }

  const handleBackClick = () => {
    if (dirty) {
      setShowExitConfirm('back')
    } else {
      goToGames()
    }
  }

  const handleExitConfirm = (confirmed: boolean) => {
    const target = showExitConfirm
    setShowExitConfirm(null)
    if (!confirmed) return
    haptic('light')
    const initialState = getInitialActivityState()
    saveActivityState(initialState)
    dispatch({ type: 'RESET_ALL' })
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
    <div className="activity-home" onPointerDown={handleTapOutside}>
      <div className="activity-home__top">
        <HomeButton
          onBeforeNavigate={() => {
            if (dirty) {
              setShowExitConfirm('home')
              return true
            }
            return false
          }}
        />
        <button type="button" className="btn btn--ghost activity-home__back" onClick={handleBackClick}>
          ← Назад
        </button>
      </div>
      <header className="activity-home__header">
        <h1 className="activity-home__title">Активитус</h1>
        <div className="activity-home__rules-box">
          <p className="activity-home__rules">
            Получаешь слово и формат действия. Покажи, объясни или изобрази — команда угадывает.
            Верный ответ приносит балл.
          </p>
        </div>
      </header>

      <section className="activity-home__section">
        <h2 className="activity-home__section-title">Количество команд</h2>
        <div className="activity-home__options">
          {TEAM_COUNT_OPTIONS.map((count) => (
            <button
              key={count}
              type="button"
              className={`btn btn--ghost activity-home__option-btn ${teamCount === count ? 'activity-home__option-btn--active' : ''}`}
              onClick={() => handleTeamCount(count)}
            >
              {count}
            </button>
          ))}
        </div>
      </section>

      <section className="activity-home__section">
        <h2 className="activity-home__section-title">Таймер раунда</h2>
        <div className="activity-home__options">
          {TIMER_OPTIONS.map((sec) => (
            <button
              key={sec}
              type="button"
              className={`btn btn--ghost activity-home__option-btn ${state.timerSeconds === sec ? 'activity-home__option-btn--active' : ''}`}
              onClick={() => handleTimer(sec)}
            >
              {sec} сек
            </button>
          ))}
        </div>
      </section>

      <section className="activity-home__section">
        <h2 className="activity-home__section-title">Категории <span className="activity-home__section-hint">(выберите одну или несколько)</span></h2>
        {state.categoryIds.length === 0 && (
          <p className="activity-home__category-hint" role="status">Выберите минимум одну категорию</p>
        )}
        <div className="activity-home__categories">
          {ACTIVITY_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`activity-home__category-card card ${state.categoryIds.includes(cat.id) ? 'activity-home__category-card--active' : ''}`}
              onClick={() => handleCategoryClick(cat.id)}
            >
              <span className="activity-home__category-emoji" aria-hidden>{cat.emoji}</span>
              <span className="activity-home__category-title">{cat.title}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="activity-home__section activity-home__section--teams">
        <ActivityTeamsSetup
          teamCount={teamCount}
          teams={teams}
          dispatch={dispatch}
          teamHint={validationHint !== 'Выберите минимум одну категорию' ? validationHint : null}
        />
      </section>

      <div className="activity-home__actions">
        <button
          type="button"
          className="btn btn--primary activity-home__start"
          disabled={!canStart}
          onClick={handleStartGame}
        >
          Начать раунд
        </button>
      </div>

      {showExitConfirm != null && (
        <div
          className="activity-home__modal-overlay"
          onClick={() => handleExitConfirm(false)}
        >
          <div className="activity-home__modal card" onClick={(e) => e.stopPropagation()}>
            <p className="activity-home__modal-text">Выйти из игры?</p>
            <p className="activity-home__modal-hint">
              Если выйти, весь прогресс будет сброшен (команды, счёт, раунд, выбранные настройки).
            </p>
            <div className="activity-home__modal-buttons">
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

export default ActivityHome
