import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAliasStateContext } from '../games/alias/AliasStateContext'
import { saveAliasState, getInitialAliasState } from '../games/alias/state'
import { ALIAS_CATEGORIES, type AliasCategoryId } from '../games/alias/data/words'
import { useBack } from '../hooks/useBack'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
import GamesPageHeader from '../components/GamesPageHeader'
import GameExitConfirmModal from '../components/GameExitConfirmModal'
import PremiumOverlay from '../components/PremiumOverlay'
import { useGameStartGate } from '../hooks/useGameStartGate'
import { TeamsSetupBlock } from '../components/alias/TeamsSetupBlock'
import './AliasHome.css'

const TEAM_COUNT_OPTIONS = [2, 3, 4, 5, 6] as const
const TIMER_OPTIONS = [30, 45, 60] as const

function AliasHome() {
  const navigate = useNavigate()
  const { state, dispatch } = useAliasStateContext()
  const [showAdultConfirm, setShowAdultConfirm] = useState<AliasCategoryId | null>(null)
  const [showExitConfirm, setShowExitConfirm] = useState<'back' | 'home' | null>(null)
  const { startLocked, premiumOverlayOpen, closePremiumOverlay, gatedStart, startCtaClassName } =
    useGameStartGate('alias', 'alias-page__cta')

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
    flushSync(() => {
      dispatch({ type: 'START_GAME' })
    })
    navigate('/alias/play', { replace: true })
  }

  const handleBackClick = () => {
    if (dirty) {
      setShowExitConfirm('back')
    } else {
      handleBack()
    }
  }

  const handleExitConfirm = (confirmed: boolean) => {
    setShowExitConfirm(null)
    if (!confirmed) return
    haptic('light')
    const initialState = getInitialAliasState()
    saveAliasState(initialState)
    dispatch({ type: 'RESET_ALL' })
    navigate('/games')
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
    <div className="alias-page alias-home" onPointerDown={handleTapOutside}>
      <div className="alias-page__top">
        <HomeButton
          className="alias-page__nav-btn"
          onBeforeNavigate={() => {
            if (dirty) {
              setShowExitConfirm('home')
              return true
            }
            return false
          }}
        />
        <BackButton onClick={handleBackClick} className="alias-page__nav-btn alias-page__back" />
      </div>

      <GamesPageHeader
        title="Ассоциации"
        tagline="Никаких однокоренных слов. Только логика."
      />

      <div className="alias-home__how alias-page__panel alias-page__panel--glow-b">
        <h3 className="alias-home__how-title">Как играть</h3>
        <ul className="alias-home__how-list">
          <li>Выберите категории и введите имена участников (команды по 2+ человека)</li>
          <li>Игрок объясняет слова жестами или описанием, без однокоренных слов</li>
          <li>За каждый верный ответ — балл. Побеждает команда с большим счётом</li>
        </ul>
      </div>

      <section className="alias-home__section alias-page__section">
        <h2 className="alias-page__section-title">Количество команд</h2>
        <div className="alias-page__chip-row">
          {TEAM_COUNT_OPTIONS.map((count) => (
            <button
              key={count}
              type="button"
              className={`alias-page__chip ${teamCount === count ? 'is-active' : ''}`}
              onClick={() => handleTeamCount(count)}
            >
              {count}
            </button>
          ))}
        </div>
      </section>

      <section className="alias-home__section alias-page__section">
        <h2 className="alias-page__section-title">Таймер раунда</h2>
        <div className="alias-page__chip-row">
          {TIMER_OPTIONS.map((sec) => (
            <button
              key={sec}
              type="button"
              className={`alias-page__chip alias-page__chip--wide ${state.timerSeconds === sec ? 'is-active' : ''}`}
              onClick={() => handleTimer(sec)}
            >
              {sec} сек
            </button>
          ))}
        </div>
      </section>

      <section className="alias-home__section alias-page__section">
        <h2 className="alias-page__section-title">
          Категории <span className="alias-home__section-hint">(выберите одну или несколько)</span>
        </h2>
        {state.categoryIds.length === 0 && (
          <p className="alias-home__category-hint" role="status">Выберите минимум одну категорию</p>
        )}
        <div className="alias-home__categories">
          {ALIAS_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`alias-home__category-card alias-page__panel alias-page__panel--glow-a ${state.categoryIds.includes(cat.id) ? 'is-active' : ''}`}
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
        <TeamsSetupBlock
          teamCount={teamCount}
          teams={teams}
          dispatch={dispatch}
          teamHint={validationHint !== 'Выберите минимум одну категорию' ? validationHint : null}
        />
      </section>

      <div className="alias-home__actions">
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

      {showAdultConfirm && (
        <div className="alias-home__modal-overlay" onClick={() => handleAdultConfirm(false)}>
          <div className="alias-home__modal alias-page__panel alias-page__panel--glow-b" onClick={(e) => e.stopPropagation()}>
            <p className="alias-home__modal-text">Мне 18+</p>
            <p className="alias-home__modal-hint">Подтвердите возраст для доступа к категории</p>
            <div className="alias-home__modal-buttons">
              <button type="button" className="alias-page__btn alias-page__btn--secondary" onClick={() => handleAdultConfirm(false)}>
                Отмена
              </button>
              <button type="button" className="alias-page__cta" onClick={() => handleAdultConfirm(true)}>
                Да, мне 18+
              </button>
            </div>
          </div>
        </div>
      )}

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

export default AliasHome
