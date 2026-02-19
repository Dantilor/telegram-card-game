import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAliasState } from '../games/alias/useAliasState'
import { useBack } from '../hooks/useBack'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import './AliasSetup.css'

const TEAM_SLOTS = 6

function AliasSetup() {
  const navigate = useNavigate()
  const [state, , dispatch] = useAliasState()
  const [playerInputs, setPlayerInputs] = useState<string[]>(() => Array(TEAM_SLOTS).fill(''))

  const handleBack = useBack('/alias')

  const activeCount = state.teams.filter(
    (t) => t.name.trim() !== '' && t.players.length > 0
  ).length
  const canStart =
    activeCount >= 2 &&
    state.teams.every(
      (t) => t.name.trim() === '' || (t.players.length > 0 && t.name.trim() !== '')
    ) &&
    state.teams.filter((t) => t.name.trim() !== '').every((t) => t.players.length > 0)

  const handleTeamName = (slotIndex: number, name: string) => {
    dispatch({ type: 'SET_TEAM_NAME', slotIndex, name })
  }

  const handleAddPlayer = (slotIndex: number) => {
    const name = (playerInputs[slotIndex] ?? '').trim()
    if (!name) return
    hapticSelection()
    dispatch({ type: 'ADD_PLAYER', slotIndex, playerName: name })
    setPlayerInputs((prev) => {
      const next = [...prev]
      next[slotIndex] = ''
      return next
    })
  }

  const handleRemovePlayer = (slotIndex: number, playerIndex: number) => {
    haptic('light')
    dispatch({ type: 'REMOVE_PLAYER', slotIndex, playerIndex })
  }

  const handleTimer = (seconds: 30 | 45 | 60) => {
    hapticSelection()
    dispatch({ type: 'SET_TIMER', seconds })
  }

  const handleStart = () => {
    if (!canStart) return
    haptic('medium')
    dispatch({ type: 'START_GAME' })
    navigate('/alias/play')
  }

  return (
    <div className="alias-setup">
      <div className="alias-setup__top">
        <HomeButton />
        <button type="button" className="btn btn--ghost alias-setup__back" onClick={handleBack}>
          ← Назад
        </button>
      </div>
      <header className="alias-setup__header">
        <h1 className="alias-setup__title">Команды</h1>
        <p className="alias-setup__tagline">От 2 до 6 команд. Заполните название и добавьте игроков.</p>
      </header>

      <section className="alias-setup__teams">
        {state.teams.map((team, slotIndex) => (
          <div key={slotIndex} className="alias-setup__team-card card">
            <label className="alias-setup__label">Название команды</label>
            <input
              type="text"
              className="alias-setup__input"
              placeholder={`Команда ${slotIndex + 1}`}
              value={team.name}
              onChange={(e) => handleTeamName(slotIndex, e.target.value)}
              maxLength={32}
            />
            <div className="alias-setup__players">
              <span className="alias-setup__players-label">Игроки:</span>
              <ul className="alias-setup__player-list">
                {team.players.map((playerName, playerIndex) => (
                  <li key={playerIndex} className="alias-setup__player-item">
                    <span className="alias-setup__player-name">{playerName}</span>
                    <button
                      type="button"
                      className="btn btn--ghost alias-setup__player-remove"
                      onClick={() => handleRemovePlayer(slotIndex, playerIndex)}
                      aria-label="Удалить"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
              <div className="alias-setup__add-row">
                <input
                  type="text"
                  className="alias-setup__input alias-setup__input--small"
                  placeholder="Имя игрока"
                  value={playerInputs[slotIndex] ?? ''}
                  onChange={(e) =>
                    setPlayerInputs((prev) => {
                      const next = [...prev]
                      next[slotIndex] = e.target.value
                      return next
                    })
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddPlayer(slotIndex)
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn--secondary alias-setup__add-btn"
                  onClick={() => handleAddPlayer(slotIndex)}
                >
                  Добавить
                </button>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="alias-setup__section">
        <h2 className="alias-setup__section-title">Таймер раунда</h2>
        <div className="alias-setup__timer-options">
          {([30, 45, 60] as const).map((sec) => (
            <button
              key={sec}
              type="button"
              className={`btn btn--ghost alias-setup__timer-btn ${state.timerSeconds === sec ? 'alias-setup__timer-btn--active' : ''}`}
              onClick={() => handleTimer(sec)}
            >
              {sec} сек
            </button>
          ))}
        </div>
      </section>

      <div className="alias-setup__actions">
        <button
          type="button"
          className="btn btn--primary alias-setup__start"
          disabled={!canStart}
          onClick={handleStart}
        >
          Начать игру
        </button>
      </div>
    </div>
  )
}

export default AliasSetup
