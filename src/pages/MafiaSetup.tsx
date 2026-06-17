import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMafiaGame } from '../games/mafia/MafiaGameContext'
import { getRoleCountsForPlayers } from '../games/mafia/roles'
import {
  MAFIA_MAX_PLAYERS,
  MAFIA_MIN_PLAYERS,
  readInitialMafiaSetupForm,
  saveMafiaSetupDraft,
} from '../games/mafia/setupStorage'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import MafiaPageNav from '../components/MafiaPageNav'
import GamesPageHeader from '../components/GamesPageHeader'
import PremiumOverlay from '../components/PremiumOverlay'
import { useGameStartGate } from '../hooks/useGameStartGate'
import { IMAGES } from '../assets/images'
import './MafiaSetup.css'

function formatRolesLine(counts: { mafia: number; doctor: number; sheriff: number; civilian: number }): string {
  const parts: string[] = []
  if (counts.mafia) parts.push(`${counts.mafia} ${counts.mafia === 1 ? 'мафия' : 'мафии'}`)
  if (counts.doctor) parts.push(`${counts.doctor} доктор`)
  if (counts.sheriff) parts.push(`${counts.sheriff} шериф`)
  if (counts.civilian) parts.push(`${counts.civilian} ${counts.civilian === 1 ? 'мирный' : 'мирных'}`)
  return parts.join(' • ')
}

function MafiaSetup() {
  const navigate = useNavigate()
  const { dispatch } = useMafiaGame()
  const [initialForm] = useState(readInitialMafiaSetupForm)
  const [count, setCount] = useState(initialForm.count)
  const [hostName, setHostName] = useState(initialForm.hostName)
  const [names, setNames] = useState<string[]>(initialForm.names)
  const { startLocked, premiumOverlayOpen, closePremiumOverlay, gatedStart, startCtaClassName } =
    useGameStartGate('mafia', 'mafia-page__cta')

  useEffect(() => {
    saveMafiaSetupDraft({ playerCount: count, hostName, playerNames: names })
  }, [count, hostName, names])

  const updateCount = (n: number) => {
    hapticSelection()
    setCount(n)
    setNames((prev) => {
      const next = prev.slice(0, n)
      while (next.length < n) next.push('')
      return next
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
    const filled = names.map((n, i) => n.trim() || `Игрок ${i + 1}`)
    if (filled.length < MAFIA_MIN_PLAYERS) return
    haptic('medium')
    saveMafiaSetupDraft({
      playerCount: count,
      hostName,
      playerNames: names.slice(0, count),
    })
    const players = filled.map((name, i) => ({
      id: `p-${i}-${Date.now()}`,
      name,
      role: 'civilian' as const,
      alive: true,
    }))
    dispatch({ type: 'START_GAME', players, hostName: hostName.trim() || 'Ведущий' })
    navigate('/mafia/roles')
  }

  const roleCounts = useMemo(() => getRoleCountsForPlayers(count), [count])
  const rolesLine = formatRolesLine(roleCounts)

  return (
    <div className="mafia-page mafia-setup">
      <MafiaPageNav variant="setup" />

      <header className="mafia-setup__hero">
        <GamesPageHeader
          title="Мафия Lite"
          tagline="Каждый скрывает роль. Кто врёт — решит утро."
        />
      </header>

      <section className="mafia-setup__section mafia-page__panel mafia-page__panel--glow-b">
        <div className="mafia-setup__section-head">
          <h2 className="mafia-setup__section-title">Количество игроков</h2>
          <p className="mafia-setup__section-note">Без ведущего</p>
        </div>
        <div className="mafia-page__chip-row">
          {Array.from({ length: MAFIA_MAX_PLAYERS - MAFIA_MIN_PLAYERS + 1 }, (_, i) => MAFIA_MIN_PLAYERS + i).map((n) => (
            <button
              key={n}
              type="button"
              className={`mafia-page__chip ${count === n ? 'is-active' : ''}`}
              onClick={() => updateCount(n)}
            >
              {n}
            </button>
          ))}
        </div>
        {rolesLine && (
          <p className="mafia-setup__roles-line">Роли: {rolesLine}</p>
        )}
      </section>

      <section className="mafia-setup__section mafia-page__panel mafia-page__panel--glow-a">
        <div className="mafia-setup__section-head">
          <h2 className="mafia-setup__section-title">Ведущий</h2>
          <p className="mafia-setup__section-note">Не играет — ведёт игру</p>
        </div>
        <div className="mafia-setup__host">
          <img src={IMAGES.mafiaHost.png} alt="" className="mafia-setup__host-thumb" decoding="async" loading="eager" />
          <input
            type="text"
            className="mafia-page__input mafia-setup__host-input"
            placeholder="Имя ведущего"
            value={hostName}
            onChange={(e) => setHostName(e.target.value)}
          />
        </div>

        <h2 className="mafia-setup__section-title mafia-setup__section-gap">Участники</h2>
        <div className="mafia-setup__names">
          {Array.from({ length: count }, (_, i) => (
            <input
              key={i}
              type="text"
              className="mafia-page__input"
              placeholder={`Игрок ${i + 1}`}
              value={names[i] ?? ''}
              onChange={(e) => updateName(i, e.target.value)}
            />
          ))}
        </div>
      </section>

      <div className="mafia-page__actions mafia-setup__actions">
        <button
          type="button"
          className={startCtaClassName}
          onClick={() => gatedStart(handleStart)}
          disabled={!startLocked && count < MAFIA_MIN_PLAYERS}
        >
          Начать раунд
        </button>
      </div>

      <PremiumOverlay isOpen={premiumOverlayOpen} onClose={closePremiumOverlay} />
    </div>
  )
}

export default MafiaSetup
