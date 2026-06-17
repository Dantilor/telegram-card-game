import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSabotageGame } from '../games/sabotage/SabotageGameContext'
import { useBack } from '../hooks/useBack'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
import GamesPageHeader from '../components/GamesPageHeader'
import PremiumOverlay from '../components/PremiumOverlay'
import { useGameStartGate } from '../hooks/useGameStartGate'
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
  const { startLocked, premiumOverlayOpen, closePremiumOverlay, gatedStart, startCtaClassName } =
    useGameStartGate('sabotage')

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

  const handleBack = useBack('/games')

  const formatTimer = (sec: number) => `${Math.floor(sec / 60)} мин`

  return (
    <div className="game-page sabotage-setup game-page--enter">
      <div className="game-page__top">
        <HomeButton className="game-page__nav-btn" />
        <BackButton onClick={handleBack} className="game-page__nav-btn game-page__back" />
      </div>

      <GamesPageHeader
        title="Саботаж"
        tagline="Один знает больше. Остальные — подозревают."
      />

      <div className="sabotage-setup__how game-page__panel game-page__panel--glow-b">
        <h3 className="sabotage-setup__how-title">Как играть</h3>
        <ul className="sabotage-setup__how-list">
          <li>Всем выдаётся одно задание</li>
          <li>Один игрок — Саботёр (узнаёт об этом тайно)</li>
          <li>Саботёр аккуратно мешает, остальные пытаются его вычислить</li>
          <li>После таймера — голосование, затем раскрытие</li>
        </ul>
      </div>

      <section className="sabotage-setup__section game-page__section">
        <h2 className="game-page__section-title">Количество участников</h2>
        <div className="game-page__chip-row">
          {Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i).map((n) => (
            <button
              key={n}
              type="button"
              className={`game-page__chip ${count === n ? 'is-active' : ''}`}
              onClick={() => updateCount(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </section>

      <section className="sabotage-setup__section game-page__section">
        <h2 className="game-page__section-title">Время на задание</h2>
        <div className="game-page__chip-row">
          {TIMER_OPTIONS.map((sec) => (
            <button
              key={sec}
              type="button"
              className={`game-page__chip game-page__chip--wide ${taskDuration === sec ? 'is-active' : ''}`}
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

      <section className="sabotage-setup__section game-page__section">
        <h2 className="game-page__section-title">Введите имена участников</h2>
        <div className="sabotage-setup__names">
          {names.slice(0, count).map((name, i) => (
            <input
              key={i}
              type="text"
              className="game-page__input"
              placeholder={`Игрок ${i + 1}`}
              value={name}
              onChange={(e) => updateName(i, e.target.value)}
            />
          ))}
        </div>
      </section>

      <div className="game-page__actions">
        <button
          type="button"
          className={startCtaClassName}
          disabled={!startLocked && count < MIN_PLAYERS}
          onClick={() => gatedStart(handleStart)}
        >
          Начать раунд
        </button>
      </div>

      <PremiumOverlay isOpen={premiumOverlayOpen} onClose={closePremiumOverlay} />
    </div>
  )
}

export default SabotageSetup
