import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAliasState } from '../games/alias/useAliasState'
import { ALIAS_CATEGORIES, shuffleFisherYates, type AliasCategoryId } from '../games/alias/data/words'
import { saveAliasState, type AliasMode } from '../games/alias/state'
import { useBack } from '../hooks/useBack'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import './AliasHome.css'

function AliasHome() {
  const navigate = useNavigate()
  const [state, setState] = useAliasState()
  const [showAdultConfirm, setShowAdultConfirm] = useState<AliasCategoryId | null>(null)

  const handleBack = useBack('/games')

  const handleModeChange = (mode: AliasMode) => {
    hapticSelection()
    setState((prev) => ({ ...prev, mode }))
  }

  const handleTimerChange = (timerSeconds: 30 | 45 | 60) => {
    hapticSelection()
    setState((prev) => ({ ...prev, timerSeconds }))
  }

  const handleCategoryClick = (categoryId: AliasCategoryId, _paid: boolean, adult?: boolean) => {
    hapticSelection()
    if (adult) {
      setShowAdultConfirm(categoryId)
      return
    }
    setState((prev) => ({ ...prev, categoryId }))
  }

  const handleAdultConfirm = (confirmed: boolean) => {
    if (confirmed && showAdultConfirm) {
      setState((prev) => ({ ...prev, categoryId: showAdultConfirm }))
    }
    setShowAdultConfirm(null)
  }

  const handleStartRound = () => {
    if (!state.categoryId) return
    haptic('medium')
    const cat = ALIAS_CATEGORIES.find((c) => c.id === state.categoryId)
    if (!cat || cat.words.length === 0) return
    const bag = shuffleFisherYates(cat.words)
    const nextState = {
      ...state,
      bag,
      bagIdx: 0,
      scores: { teamA: 0, teamB: 0 },
      lastPlayedTeam: null,
    }
    setState(nextState)
    saveAliasState(nextState)
    navigate('/alias/play')
  }

  return (
    <div className="alias-home">
      <div className="alias-home__top">
        <HomeButton />
        <button type="button" className="btn btn--ghost alias-home__back" onClick={handleBack}>
          ← Назад
        </button>
      </div>
      <header className="alias-home__header">
        <h1 className="alias-home__title">Alias / Крокодил</h1>
        <p className="alias-home__tagline">Объясняй слова без однокоренных</p>
      </header>

      <section className="alias-home__section">
        <h2 className="alias-home__section-title">Настройки</h2>
        <div className="alias-home__mode-row">
          <span className="alias-home__label">Режим:</span>
          <div className="alias-home__mode-toggle">
            <button
              type="button"
              className={`btn btn--ghost alias-home__mode-btn ${state.mode === 'solo' ? 'alias-home__mode-btn--active is-active' : ''}`}
              onClick={() => handleModeChange('solo')}
            >
              Одиночный
            </button>
            <button
              type="button"
              className={`btn btn--ghost alias-home__mode-btn ${state.mode === 'team' ? 'alias-home__mode-btn--active is-active' : ''}`}
              onClick={() => handleModeChange('team')}
            >
              Командный
            </button>
          </div>
        </div>
        <div className="alias-home__timer-row">
          <span className="alias-home__label">Таймер:</span>
          <div className="alias-home__timer-options">
            {([30, 45, 60] as const).map((sec) => (
              <button
                key={sec}
                type="button"
                className={`btn btn--ghost alias-home__timer-btn ${state.timerSeconds === sec ? 'alias-home__timer-btn--active is-active' : ''}`}
                onClick={() => handleTimerChange(sec)}
              >
                {sec} сек
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="alias-home__section">
        <h2 className="alias-home__section-title">Категория</h2>
        <div className="alias-home__categories">
          {ALIAS_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`alias-home__category-card card ${state.categoryId === cat.id ? 'alias-home__category-card--active' : ''}`}
              onClick={() => handleCategoryClick(cat.id, cat.paid, cat.adult)}
            >
              <span className="alias-home__category-emoji" aria-hidden>{cat.emoji}</span>
              <span className="alias-home__category-title">{cat.title}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="alias-home__actions">
        <button
          type="button"
          className="btn btn--primary alias-home__start"
          disabled={!state.categoryId}
          onClick={handleStartRound}
        >
          Начать раунд
        </button>
      </div>

      <section className="alias-home__rules">
        <h3 className="alias-home__rules-title">Правила</h3>
        <p className="alias-home__rules-text">
          Объясняй слово жестами или словами, но без однокоренных. За каждое угаданное — очко. Пропуск — без очка.
        </p>
      </section>

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
    </div>
  )
}

export default AliasHome
