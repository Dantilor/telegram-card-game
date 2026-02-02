import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { GameMode, GoalAmount } from '../games/city-economy/types'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import './CityEconomyHome.css'

function CityEconomyHome() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<GameMode>('solo')
  const [goal, setGoal] = useState<GoalAmount>(50)

  const handleBack = () => {
    haptic('light')
    navigate(-1)
  }

  const handleStart = () => {
    haptic('medium')
    navigate('/city-economy/play', { state: { mode, goal } })
  }

  return (
    <div className="city-economy-home">
      <div className="city-economy-home__top">
        <HomeButton />
        <button
          type="button"
          className="btn btn--ghost city-economy-home__back"
          onClick={handleBack}
        >
          ← Назад
        </button>
      </div>
      <header className="city-economy-home__header">
        <h1 className="city-economy-home__title">Экономика города</h1>
        <p className="city-economy-home__tagline">Лайт-монополия в картах</p>
      </header>

      <section className="city-economy-home__section">
        <h2 className="city-economy-home__section-title">Режим</h2>
        <div className="city-economy-home__options">
          <button
            type="button"
            className={`btn btn--ghost city-economy-home__opt ${mode === 'solo' ? 'is-active' : ''}`}
            onClick={() => {
              hapticSelection()
              setMode('solo')
            }}
          >
            Одиночный
          </button>
          <button
            type="button"
            className={`btn btn--ghost city-economy-home__opt ${mode === 'company' ? 'is-active' : ''}`}
            onClick={() => {
              hapticSelection()
              setMode('company')
            }}
          >
            Компания
          </button>
        </div>
      </section>

      <section className="city-economy-home__section">
        <h2 className="city-economy-home__section-title">Цель</h2>
        <div className="city-economy-home__options">
          <button
            type="button"
            className={`btn btn--ghost city-economy-home__opt city-economy-home__opt--goal ${goal === 50 ? 'is-active' : ''}`}
            onClick={() => {
              hapticSelection()
              setGoal(50)
            }}
          >
            50 монет
          </button>
          <button
            type="button"
            className={`btn btn--ghost city-economy-home__opt city-economy-home__opt--goal ${goal === 100 ? 'is-active' : ''}`}
            onClick={() => {
              hapticSelection()
              setGoal(100)
            }}
          >
            100 монет
          </button>
        </div>
      </section>

      <div className="city-economy-home__actions">
        <button
          type="button"
          className="btn btn--primary city-economy-home__start"
          onClick={handleStart}
        >
          Начать игру
        </button>
      </div>
    </div>
  )
}

export default CityEconomyHome
