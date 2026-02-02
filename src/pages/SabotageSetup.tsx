import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSabotageGame } from '../games/sabotage/SabotageGameContext'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import './SabotageSetup.css'

const MIN_PLAYERS = 3
const MAX_PLAYERS = 10
const TIMER_OPTIONS = [180, 240, 300] as const

function SabotageSetup() {
  const navigate = useNavigate()
  const { dispatch } = useSabotageGame()
  const [count, setCount] = useState(5)
  const [names, setNames] = useState<string[]>(() => Array(5).fill(''))
  const [taskDuration, setTaskDuration] = useState<number>(180)

  const updateCount = (n: number) => {
    hapticSelection()
    setCount(n)
    setNames((prev) => {
      const next = [...prev]
      while (next.length < n) next.push('')
      return next.slice(0, n)
    })
  }

  const updateName = (i: number, v: string) => {
    setNames((prev) => {
      const next = [...prev]
      next[i] = v
      return next
    })
  }

  const handleStart = () => {
    const filled = names.slice(0, count).map((n, i) => n.trim() || `Игрок ${i + 1}`)
    if (filled.length < MIN_PLAYERS) return
    haptic('medium')
    const players = filled.map((name, i) => ({
      id: `p-${i}-${Date.now()}`,
      name,
    }))
    dispatch({ type: 'START_GAME', players, taskDurationSeconds: taskDuration })
    navigate('/sabotage/role')
  }

  const handleBack = () => {
    haptic('light')
    navigate('/games')
  }

  const formatTimer = (sec: number) => `${Math.floor(sec / 60)} мин`

  return (
    <div className="sabotage-setup">
      <div className="sabotage-setup__top">
        <HomeButton />
        <button type="button" className="btn btn--ghost sabotage-setup__back" onClick={handleBack}>
          ← В меню
        </button>
      </div>
      <header className="sabotage-setup__header">
        <h1 className="sabotage-setup__title">Саботаж</h1>
        <p className="sabotage-setup__tagline">Один знает задание и мешает тайно</p>
      </header>

      <section className="sabotage-setup__section">
        <h2 className="sabotage-setup__section-title">Игроки</h2>
        <div className="sabotage-setup__count-row">
          {Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i).map((n) => (
            <button
              key={n}
              type="button"
              className={`btn btn--ghost sabotage-setup__count-btn ${count === n ? 'is-active' : ''}`}
              onClick={() => updateCount(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </section>

      <section className="sabotage-setup__section">
        <h2 className="sabotage-setup__section-title">Имена</h2>
        <div className="sabotage-setup__names">
          {names.slice(0, count).map((name, i) => (
            <input
              key={i}
              type="text"
              className="sabotage-setup__input card"
              placeholder={`Игрок ${i + 1}`}
              value={name}
              onChange={(e) => updateName(i, e.target.value)}
            />
          ))}
        </div>
      </section>

      <section className="sabotage-setup__section">
        <h2 className="sabotage-setup__section-title">Время на задание</h2>
        <div className="sabotage-setup__timer-row">
          {TIMER_OPTIONS.map((sec) => (
            <button
              key={sec}
              type="button"
              className={`btn btn--ghost sabotage-setup__timer-btn ${taskDuration === sec ? 'is-active' : ''}`}
              onClick={() => {
                hapticSelection()
                setTaskDuration(sec)
              }}
            >
              {formatTimer(sec)}
            </button>
          ))}
        </div>
      </section>

      <div className="sabotage-setup__actions">
        <button
          type="button"
          className="btn btn--primary sabotage-setup__start"
          onClick={handleStart}
          disabled={count < MIN_PLAYERS}
        >
          Начать игру
        </button>
      </div>
    </div>
  )
}

export default SabotageSetup
