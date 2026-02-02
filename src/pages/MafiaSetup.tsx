import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMafiaGame } from '../games/mafia/MafiaGameContext'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import './MafiaSetup.css'

function MafiaSetup() {
  const navigate = useNavigate()
  const { dispatch } = useMafiaGame()
  const [count, setCount] = useState(6)
  const [names, setNames] = useState<string[]>(() => Array(6).fill(''))

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
    if (filled.length < 4) return
    haptic('medium')
    const players = filled.map((name, i) => ({
      id: `p-${i}-${Date.now()}`,
      name,
      role: 'civilian' as const,
      alive: true,
    }))
    dispatch({ type: 'START_GAME', players })
    navigate('/mafia/roles')
  }

  const handleBack = () => {
    haptic('light')
    navigate('/games')
  }

  return (
    <div className="mafia-setup">
      <div className="mafia-setup__top">
        <HomeButton />
        <button type="button" className="btn btn--ghost mafia-setup__back" onClick={handleBack}>
          ← В меню
        </button>
      </div>
      <header className="mafia-setup__header">
        <h1 className="mafia-setup__title">Мафия (мини)</h1>
        <p className="mafia-setup__tagline">Настройка игры</p>
      </header>

      <section className="mafia-setup__section">
        <h2 className="mafia-setup__section-title">Количество игроков</h2>
        <div className="mafia-setup__count-row">
          {[4, 5, 6, 7, 8, 9, 10].map((n) => (
            <button
              key={n}
              type="button"
              className={`btn btn--ghost mafia-setup__count-btn ${count === n ? 'is-active' : ''}`}
              onClick={() => updateCount(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </section>

      <section className="mafia-setup__section">
        <h2 className="mafia-setup__section-title">Имена игроков</h2>
        <div className="mafia-setup__names">
          {names.slice(0, count).map((name, i) => (
            <input
              key={i}
              type="text"
              className="mafia-setup__input card"
              placeholder={`Игрок ${i + 1}`}
              value={name}
              onChange={(e) => updateName(i, e.target.value)}
            />
          ))}
        </div>
      </section>

      <div className="mafia-setup__actions">
        <button
          type="button"
          className="btn btn--primary mafia-setup__start"
          onClick={handleStart}
          disabled={count < 4}
        >
          Начать игру
        </button>
      </div>
    </div>
  )
}

export default MafiaSetup
