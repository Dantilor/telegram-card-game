import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useCityEconomyGame } from '../games/city-economy/hooks/useCityEconomyGame'
import type { GameMode, GoalAmount, EventCard } from '../games/city-economy/types'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import './CityEconomyPlay.css'

function formatEventCard(event: EventCard | null): string {
  if (!event) return ''
  switch (event.type) {
    case 'tax':
    case 'crisis':
      return `${event.label}: ${event.value}`
    case 'luck':
      return `${event.label}: +${event.value}`
    case 'investment':
      return `${event.label}: −${event.cost} → +${event.profit} (${event.delay} ход)`
    default:
      return (event as EventCard).label
  }
}

function CityEconomyPlay() {
  const navigate = useNavigate()
  const location = useLocation()
  const routeState = location.state as { mode?: GameMode; goal?: GoalAmount } | null
  const mode = routeState?.mode ?? 'solo'
  const goal = (routeState?.goal ?? 50) as GoalAmount

  const { state, takeIncome, riskIncome, skipTurn, skipToResult } = useCityEconomyGame(
    mode as GameMode,
    goal as GoalAmount
  )

  const handleBack = () => {
    haptic('light')
    navigate('/city-economy')
  }

  useEffect(() => {
    if (state.phase === 'game_over' && state.result) {
      navigate('/city-economy/result', {
        state: { result: state.result, coins: state.coins, goal: state.goal, mode: state.mode },
      })
    }
  }, [state.phase, state.result, state.coins, state.goal, state.mode, navigate])

  if (state.phase === 'game_over') {
    return (
      <div className="city-economy-play">
        <div className="city-economy-play__processing">
          <p>Подведение итогов…</p>
        </div>
      </div>
    )
  }

  const income = state.currentIncome
  const event = state.currentEvent
  const isProcessing = state.phase === 'processing'

  return (
    <div className="city-economy-play">
      <div className="city-economy-play__top">
        <button
          type="button"
          className="btn btn--ghost city-economy-play__back"
          onClick={handleBack}
        >
          ← Меню
        </button>
        <HomeButton />
      </div>

      <div className="city-economy-play__stats">
        <div className="city-economy-play__coins">
          <span className="city-economy-play__coins-icon">🪙</span>
          <span className="city-economy-play__coins-value">{state.coins}</span>
        </div>
        <div className="city-economy-play__turn">
          Ход {state.turn} / {state.maxTurns}
        </div>
        <div className="city-economy-play__goal">
          Цель: {state.goal}
        </div>
      </div>

      {state.assets.length > 0 && (
        <div className="city-economy-play__assets card">
          <h3 className="city-economy-play__assets-title">Активы</h3>
          <ul className="city-economy-play__assets-list">
            {state.assets.map((a) => (
              <li key={a.id}>
                {a.label}: +{a.profit} через {a.turnsLeft} ход
              </li>
            ))}
          </ul>
        </div>
      )}

      {state.phase === 'turn_start' && income && event && (
        <div className="city-economy-play__cards">
          <div className="city-economy-play__card card city-economy-play__card--income">
            <span className="city-economy-play__card-label">Доход</span>
            <span className="city-economy-play__card-value city-economy-play__card-value--plus">
              +{income.value}
            </span>
            <span className="city-economy-play__card-name">{income.label}</span>
          </div>
          <div className="city-economy-play__card card city-economy-play__card--event">
            <span className="city-economy-play__card-label">Событие</span>
            <span className="city-economy-play__card-name city-economy-play__card-event-text">
              {formatEventCard(event)}
            </span>
          </div>
        </div>
      )}

      {state.phase === 'processing' && (
        <div className="city-economy-play__processing">
          <span className={`city-economy-play__delta ${state.lastDelta >= 0 ? 'city-economy-play__delta--plus' : 'city-economy-play__delta--minus'}`}>
            {state.lastDelta >= 0 ? '+' : ''}{state.lastDelta}
          </span>
        </div>
      )}

      {state.phase === 'turn_start' && income && !isProcessing && (
        <div className="city-economy-play__actions">
          <button
            type="button"
            className="btn btn--primary city-economy-play__btn"
            onClick={() => {
              hapticSelection()
              takeIncome()
            }}
          >
            Забрать
          </button>
          <button
            type="button"
            className="btn btn--secondary city-economy-play__btn"
            onClick={() => {
              hapticSelection()
              riskIncome()
            }}
          >
            Рискнуть (50/50)
          </button>
          <button
            type="button"
            className="btn btn--ghost city-economy-play__btn"
            onClick={() => {
              haptic('light')
              skipTurn()
            }}
          >
            Следующий ход
          </button>
        </div>
      )}

      <div className="city-economy-play__footer">
        <button
          type="button"
          className="btn btn--ghost city-economy-play__exit"
          onClick={() => {
            haptic('light')
            skipToResult()
          }}
        >
          Выйти в меню
        </button>
      </div>
    </div>
  )
}

export default CityEconomyPlay
