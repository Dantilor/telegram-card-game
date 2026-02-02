import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ACTIVITY_CATEGORIES, getCategoryById, type ActivityCategoryId } from '../games/activity/data/activityWords'
import type { ActivityMode } from '../games/activity/types'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import './ActivityHome.css'

type TimerOption = 30 | 45 | 60

function ActivityHome() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<ActivityMode>('solo')
  const [timerSeconds, setTimerSeconds] = useState<TimerOption>(60)
  const [categoryId, setCategoryId] = useState<ActivityCategoryId | null>('basic')
  const [showPaidModal, setShowPaidModal] = useState(false)

  const handleBack = () => {
    haptic('light')
    navigate(-1)
  }

  const handleCategoryClick = (id: ActivityCategoryId, paid: boolean) => {
    hapticSelection()
    if (paid) {
      setShowPaidModal(true)
      return
    }
    setCategoryId(id)
  }

  const handleStart = () => {
    const cat = categoryId ? getCategoryById(categoryId) : null
    if (!cat) return
    haptic('medium')
    navigate('/activity/play', { state: { mode, timerSeconds, category: cat } })
  }

  return (
    <div className="activity-home">
      <div className="activity-home__top">
        <HomeButton />
        <button type="button" className="btn btn--ghost activity-home__back" onClick={handleBack}>
          ← Назад
        </button>
      </div>
      <header className="activity-home__header">
        <h1 className="activity-home__title">Activity</h1>
        <p className="activity-home__tagline">Задание + слово</p>
      </header>

      <section className="activity-home__section">
        <h2 className="activity-home__section-title">Режим</h2>
        <div className="activity-home__options">
          <button
            type="button"
            className={`btn btn--ghost activity-home__opt ${mode === 'solo' ? 'is-active' : ''}`}
            onClick={() => { hapticSelection(); setMode('solo') }}
          >
            Одиночный
          </button>
          <button
            type="button"
            className={`btn btn--ghost activity-home__opt ${mode === 'team' ? 'is-active' : ''}`}
            onClick={() => { hapticSelection(); setMode('team') }}
          >
            Командный
          </button>
        </div>
      </section>

      <section className="activity-home__section">
        <h2 className="activity-home__section-title">Таймер</h2>
        <div className="activity-home__options">
          {([30, 45, 60] as const).map((sec) => (
            <button
              key={sec}
              type="button"
              className={`btn btn--ghost activity-home__opt ${timerSeconds === sec ? 'is-active' : ''}`}
              onClick={() => { hapticSelection(); setTimerSeconds(sec) }}
            >
              {sec} сек
            </button>
          ))}
        </div>
      </section>

      <section className="activity-home__section">
        <h2 className="activity-home__section-title">Категория</h2>
        <div className="activity-home__categories">
          {ACTIVITY_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`activity-home__cat card ${categoryId === cat.id ? 'is-active' : ''} ${cat.paid ? 'activity-home__cat--locked' : ''}`}
              onClick={() => handleCategoryClick(cat.id, cat.paid)}
            >
              <span className="activity-home__cat-emoji">{cat.emoji}</span>
              <span className="activity-home__cat-title">{cat.title}</span>
              {cat.paid && <span className="activity-home__lock">🔒</span>}
            </button>
          ))}
        </div>
      </section>

      <div className="activity-home__actions">
        <button
          type="button"
          className="btn btn--primary activity-home__start"
          disabled={!categoryId}
          onClick={handleStart}
        >
          Начать игру
        </button>
      </div>

      {showPaidModal && (
        <div className="activity-home__modal-overlay" onClick={() => setShowPaidModal(false)}>
          <div className="activity-home__modal card" onClick={(e) => e.stopPropagation()}>
            <p>Пак будет доступен позже</p>
            <button type="button" className="btn btn--primary" onClick={() => setShowPaidModal(false)}>
              Ок
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ActivityHome
