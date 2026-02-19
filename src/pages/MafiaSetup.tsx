import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMafiaGame } from '../games/mafia/MafiaGameContext'
import { getRoleCountsForPlayers } from '../games/mafia/roles'
import { useBack } from '../hooks/useBack'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import { IMAGES } from '../assets/images'
import './MafiaSetup.css'

function formatRolesLine(counts: { mafia: number; doctor: number; sheriff: number; civilian: number }): string {
  const parts: string[] = []
  if (counts.mafia) parts.push(`${counts.mafia} ${counts.mafia === 1 ? 'мафия' : 'мафии'}`)
  if (counts.doctor) parts.push(`${counts.doctor} доктор`)
  if (counts.sheriff) parts.push(`${counts.sheriff} комиссар`)
  if (counts.civilian) parts.push(`${counts.civilian} ${counts.civilian === 1 ? 'мирный' : 'мирных'}`)
  return parts.join(' • ')
}

function MafiaSetup() {
  const navigate = useNavigate()
  const { dispatch } = useMafiaGame()
  const [count, setCount] = useState(5)
  // names[0] = ведущий, names[1..count] = игроки
  const [names, setNames] = useState<string[]>(() => Array(5 + 1).fill('')) // 1 ведущий + 5 игроков

  const updateCount = (n: number) => {
    hapticSelection()
    setCount(n)
    setNames((prev) => {
      const host = prev[0] ?? ''
      const players = prev.slice(1, prev.length)
      const next = [host]
      while (next.length < n + 1) next.push(players[next.length - 1] ?? '')
      return next.slice(0, n + 1)
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
    const playerNames = names.slice(1, count + 1)
    const filled = playerNames.map((n, i) => n.trim() || `Игрок ${i + 1}`)
    if (filled.length < 5) return
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

  const handleBack = useBack('/games')
  const roleCounts = useMemo(() => getRoleCountsForPlayers(count), [count])
  const rolesLine = formatRolesLine(roleCounts)

  return (
    <div className="mafia-setup">
      <div className="mafia-setup__top">
        <HomeButton />
        <button type="button" className="btn btn--ghost mafia-setup__back" onClick={handleBack}>
          ← В меню
        </button>
      </div>
      <header className="mafia-setup__header">
        <h1 className="mafia-setup__title">Мафия Lite</h1>
        <p className="mafia-setup__tagline">Каждый скрывает роль. Кто врёт — решит утро.</p>
      </header>

      <section className="mafia-setup__section">
        <h2 className="mafia-setup__section-title">Количество игроков:</h2>
        <div className="mafia-setup__count-row">
          {[5, 6, 7, 8, 9, 10].map((n) => (
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
        {rolesLine && (
          <p className="mafia-setup__roles-indicator">
            Роли: {rolesLine}
          </p>
        )}
      </section>

      <section className="mafia-setup__section">
        <h2 className="mafia-setup__section-title">Введите имена участников</h2>
        <div className="mafia-setup__names">
          <div className="mafia-setup__name-row mafia-setup__name-row--host card">
            <img src={IMAGES.mafiaHost.png} alt="" className="mafia-setup__host-thumb" />
            <div className="mafia-setup__name-row-inner">
              <span className="mafia-setup__name-label">Ведущий</span>
              <input
                type="text"
                className="mafia-setup__input"
                placeholder="Имя ведущего"
                value={names[0] ?? ''}
                onChange={(e) => updateName(0, e.target.value)}
              />
            </div>
          </div>
          {Array.from({ length: count }, (_, i) => i + 1).map((i) => (
            <input
              key={i}
              type="text"
              className="mafia-setup__input card"
              placeholder={`Игрок ${i}`}
              value={names[i] ?? ''}
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
          disabled={count < 5}
        >
          Начать игру
        </button>
      </div>
    </div>
  )
}

export default MafiaSetup
