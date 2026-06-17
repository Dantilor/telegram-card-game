import { useState } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useActivityStateContext } from '../games/activity/ActivityStateContext'
import { saveActivityState, getInitialActivityState } from '../games/activity/state'
import { ACTIVITY_CATEGORIES, type ActivityCategoryId } from '../games/activity/data/activityWords'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
import GamesPageHeader from '../components/GamesPageHeader'
import GameExitConfirmModal from '../components/GameExitConfirmModal'
import PremiumOverlay from '../components/PremiumOverlay'
import { useGameStartGate } from '../hooks/useGameStartGate'
import { ActivityTeamsSetup } from '../components/activity/ActivityTeamsSetup'
import './ActivityHome.css'

const TEAM_COUNT_OPTIONS = [2, 3, 4, 5, 6] as const
const TIMER_OPTIONS = [30, 45, 60] as const

function ActivityHome() {
  const navigate = useNavigate()
  const { state, dispatch } = useActivityStateContext()
  const [showExitConfirm, setShowExitConfirm] = useState<'back' | 'home' | null>(null)

  const { startLocked, premiumOverlayOpen, closePremiumOverlay, gatedStart, startCtaClassName } =
    useGameStartGate('activity')

  const goToGames = () => {
    haptic('light')
    navigate('/games')
  }

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
    flushSync(() => {
      dispatch({ type: 'START_GAME' })
    })
    navigate('/activity/play', { replace: true })
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
    <div className="game-page activity-home game-page--enter" onPointerDown={handleTapOutside}>
      <div className="game-page__top">
        <HomeButton
          className="game-page__nav-btn"
          onBeforeNavigate={() => {
            if (dirty) {
              setShowExitConfirm('home')
              return true
            }
            return false
          }}
        />
        <BackButton onClick={handleBackClick} className="game-page__nav-btn game-page__back" />
      </div>

      <GamesPageHeader
        title="Активитус"
        tagline="Без пауз. Только импровизация."
      />

      <div className="activity-home__how game-page__panel game-page__panel--glow-b">
        <h3 className="activity-home__how-title">Как играть</h3>
        <ul className="activity-home__how-list">
          <li>Игрок получает слово и формат действия</li>
          <li>Нужно показать, объяснить или нарисовать слово (в зависимости от формата)</li>
          <li>Команда угадывает слово</li>
          <li>За каждый верный ответ — 1 балл. Побеждает команда с наибольшим количеством баллов</li>
        </ul>
        <h3 className="activity-home__how-title activity-home__important-title">Важно</h3>
        <ul className="activity-home__how-list">
          <li>Подготовьте лист бумаги и ручку — в некоторых раундах нужно будет рисовать</li>
        </ul>
      </div>

      <section className="activity-home__section game-page__section">
        <h2 className="game-page__section-title">Количество команд</h2>
        <div className="game-page__chip-row">
          {TEAM_COUNT_OPTIONS.map((count) => (
            <button
              key={count}
              type="button"
              className={`game-page__chip ${teamCount === count ? 'is-active' : ''}`}
              onClick={() => handleTeamCount(count)}
            >
              {count}
            </button>
          ))}
        </div>
      </section>

      <section className="activity-home__section game-page__section">
        <h2 className="game-page__section-title">Таймер раунда</h2>
        <div className="game-page__chip-row">
          {TIMER_OPTIONS.map((sec) => (
            <button
              key={sec}
              type="button"
              className={`game-page__chip game-page__chip--wide ${state.timerSeconds === sec ? 'is-active' : ''}`}
              onClick={() => handleTimer(sec)}
            >
              {sec} сек
            </button>
          ))}
        </div>
      </section>

      <section className="activity-home__section game-page__section">
        <h2 className="game-page__section-title">
          Категории <span className="activity-home__section-hint">(выберите одну или несколько)</span>
        </h2>
        {state.categoryIds.length === 0 && (
          <p className="activity-home__category-hint" role="status">Выберите минимум одну категорию</p>
        )}
        <div className="activity-home__categories">
          {ACTIVITY_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`activity-home__category-card game-page__panel game-page__panel--glow-a game-page__category-card ${state.categoryIds.includes(cat.id) ? 'is-active' : ''}`}
              onClick={() => handleCategoryClick(cat.id)}
            >
              <span className="activity-home__category-emoji" aria-hidden>{cat.emoji}</span>
              <span className="activity-home__category-title game-page__category-title">{cat.title}</span>
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

      <div className="game-page__actions">
        <button
          type="button"
          className={startCtaClassName}
          disabled={!startLocked && !canStart}
          onClick={() => gatedStart(handleStartGame)}
        >
          Начать раунд
        </button>
      </div>

      <PremiumOverlay isOpen={premiumOverlayOpen} onClose={closePremiumOverlay} />

      {showExitConfirm != null && (
        <GameExitConfirmModal
          hint="Если выйти, весь прогресс будет сброшен (команды, счёт, раунд, выбранные настройки)."
          onCancel={() => handleExitConfirm(false)}
          onConfirm={() => handleExitConfirm(true)}
        />
      )}
    </div>
  )
}

export default ActivityHome
