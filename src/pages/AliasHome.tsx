import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAliasState } from '../games/alias/useAliasState'
import { ALIAS_CATEGORIES, type AliasCategoryId } from '../games/alias/data/words'
import { useBack } from '../hooks/useBack'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import { TeamsSetupBlock } from '../components/alias/TeamsSetupBlock'
import './AliasHome.css'

const TEAM_COUNT_OPTIONS = [2, 3, 4, 5, 6] as const
const TIMER_OPTIONS = [30, 45, 60] as const

function AliasHome() {
  const navigate = useNavigate()
  const [state, , dispatch] = useAliasState()
  const [showAdultConfirm, setShowAdultConfirm] = useState<AliasCategoryId | null>(null)
  const [showExitConfirm, setShowExitConfirm] = useState<'back' | 'home' | null>(null)

  const handleBack = useBack('/games')

  const teamCount = state.teamCount
  const teams = state.teams

  const hasNamesOrPlayers = state.teams.some(
    (t) => t.name.trim() !== '' || t.players.length > 0
  )
  const hasScores = state.teamScores.some((s) => s > 0)
  const dirty =
    teamCount !== 2 ||
    state.timerSeconds !== 30 ||
    state.categoryIds.length > 0 ||
    hasNamesOrPlayers ||
    state.phase !== 'setup' ||
    hasScores

  useEffect(() => {
    if (typeof import.meta.env !== 'undefined' && import.meta.env?.DEV) {
      console.log('[Alias] settings', {
        teamsCount: state.teamCount,
        timer: state.timerSeconds,
        categories: state.categoryIds,
      })
    }
  }, [state.teamCount, state.timerSeconds, state.categoryIds])

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

  const handleCategoryClick = (categoryId: AliasCategoryId, _paid: boolean, adult?: boolean) => {
    hapticSelection()
    if (adult) {
      if (state.categoryIds.includes(categoryId)) {
        dispatch({
          type: 'SET_CATEGORY_IDS',
          categoryIds: state.categoryIds.filter((id) => id !== categoryId),
        })
        return
      }
      setShowAdultConfirm(categoryId)
      return
    }
    const nextIds = state.categoryIds.includes(categoryId)
      ? state.categoryIds.filter((id) => id !== categoryId)
      : [...state.categoryIds, categoryId]
    dispatch({ type: 'SET_CATEGORY_IDS', categoryIds: nextIds })
  }

  const handleAdultConfirm = (confirmed: boolean) => {
    if (confirmed && showAdultConfirm) {
      const nextIds = state.categoryIds.includes(showAdultConfirm)
        ? state.categoryIds
        : [...state.categoryIds, showAdultConfirm]
      dispatch({ type: 'SET_CATEGORY_IDS', categoryIds: nextIds })
    }
    setShowAdultConfirm(null)
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
    dispatch({ type: 'START_GAME' })
    navigate('/alias/play')
  }

  const handleBackClick = () => {
    if (dirty) {
      setShowExitConfirm('back')
    } else {
      handleBack()
    }
  }

  const handleExitConfirm = (confirmed: boolean) => {
    const target = showExitConfirm
    setShowExitConfirm(null)
    if (!confirmed) return
    haptic('light')
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
    <div className="alias-home" onPointerDown={handleTapOutside}>
      <div className="alias-home__top">
        <HomeButton
          onBeforeNavigate={() => {
            if (dirty) {
              setShowExitConfirm('home')
              return true
            }
            return false
          }}
        />
        <button type="button" className="btn btn--ghost alias-home__back" onClick={handleBackClick}>
          ← Назад
        </button>
      </div>
      <header className="alias-home__header">
        <h1 className="alias-home__title">Ассоциации</h1>
        <p className="alias-home__tagline">
          Объясняй слово жестами или описанием, но без однокоренных слов. За каждый верный ответ — балл. В команде — минимум 2 игрока.
        </p>
      </header>

      <section className="alias-home__section">
        <h2 className="alias-home__section-title">Количество команд</h2>
        <div className="alias-home__options">
          {TEAM_COUNT_OPTIONS.map((count) => (
            <button
              key={count}
              type="button"
              className={`btn btn--ghost alias-home__option-btn ${teamCount === count ? 'alias-home__option-btn--active' : ''}`}
              onClick={() => handleTeamCount(count)}
            >
              {count}
            </button>
          ))}
        </div>
      </section>

      <section className="alias-home__section">
        <h2 className="alias-home__section-title">Таймер раунда</h2>
        <div className="alias-home__options">
          {TIMER_OPTIONS.map((sec) => (
            <button
              key={sec}
              type="button"
              className={`btn btn--ghost alias-home__option-btn ${state.timerSeconds === sec ? 'alias-home__option-btn--active' : ''}`}
              onClick={() => handleTimer(sec)}
            >
              {sec} сек
            </button>
          ))}
        </div>
      </section>

      <section className="alias-home__section">
        <h2 className="alias-home__section-title">Категории</h2>
        <div className="alias-home__categories">
          {ALIAS_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`alias-home__category-card card ${state.categoryIds.includes(cat.id) ? 'alias-home__category-card--active' : ''}`}
              onClick={() => handleCategoryClick(cat.id, cat.paid, cat.adult)}
            >
              <span className="alias-home__category-emoji" aria-hidden>{cat.emoji}</span>
              <span className="alias-home__category-title">{cat.title}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="alias-home__section alias-home__section--teams">
        {/* Не вешать key на TeamsSetupBlock от teamCount/timer/categories — иначе remount сбрасывает подсветки и локальный state. */}
        <TeamsSetupBlock teamCount={teamCount} teams={teams} dispatch={dispatch} />
      </section>

      <section className="alias-home__rules">
        <h3 className="alias-home__rules-title">Правила</h3>
        <p className="alias-home__rules-text">
          Объясняй слово жестами или описанием, но без однокоренных слов. За каждый верный ответ — балл. В команде — минимум 2 игрока.
        </p>
      </section>

      <div className="alias-home__actions">
        {validationHint != null && (
          <p className="alias-home__hint" role="status">{validationHint}</p>
        )}
        <button
          type="button"
          className="btn btn--primary alias-home__start"
          disabled={!canStart}
          onClick={handleStartGame}
        >
          Начать игру
        </button>
      </div>

      {showAdultConfirm && (
        <div className="alias-home__modal-overlay" onClick={() => handleAdultConfirm(false)}>
          <div className="alias-home__modal card" onClick={(e) => e.stopPropagation()}>
            <p className="alias-home__modal-text">Мне 18+</p>
            <p className="alias-home__modal-hint">Подтвердите возраст для доступа к категории</p>
            <div className="alias-home__modal-buttons">
              <button type="button" className="btn btn--ghost" onClick={() => handleAdultConfirm(false)}>
                Отмена
              </button>
              <button type="button" className="btn btn--primary" onClick={() => handleAdultConfirm(true)}>
                Да, мне 18+
              </button>
            </div>
          </div>
        </div>
      )}

      {showExitConfirm != null && (
        <div
          className="alias-home__modal-overlay"
          onClick={() => handleExitConfirm(false)}
        >
          <div className="alias-home__modal card" onClick={(e) => e.stopPropagation()}>
            <p className="alias-home__modal-text">Выйти из игры?</p>
            <p className="alias-home__modal-hint">
              Если выйти, весь прогресс будет сброшен (команды, счёт, раунд, выбранные настройки).
            </p>
            <div className="alias-home__modal-buttons">
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

export default AliasHome
