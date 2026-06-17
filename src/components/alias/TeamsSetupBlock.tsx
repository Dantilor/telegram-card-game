import { useState, useRef } from 'react'
import type { AliasTeamSlot } from '../../games/alias/types'
import type { AliasAction } from '../../games/alias/reducer'
import { haptic } from '../../utils/telegram'
import { hapticSelection } from '../../utils/haptics'
import './TeamsSetupBlock.css'

type Props = {
  teamCount: number
  teams: AliasTeamSlot[]
  dispatch: (action: AliasAction) => void
  teamHint?: string | null
}

export function TeamsSetupBlock({ teamCount, teams, dispatch, teamHint }: Props) {
  const [playerInputs, setPlayerInputs] = useState<string[]>(() => Array(6).fill(''))
  const playerInputRefs = useRef<(HTMLInputElement | null)[]>([])

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
    playerInputRefs.current[slotIndex]?.blur()
  }

  const handleRemovePlayer = (slotIndex: number, playerIndex: number) => {
    haptic('light')
    dispatch({ type: 'REMOVE_PLAYER', slotIndex, playerIndex })
  }

  const visibleTeams = teams.slice(0, teamCount)

  return (
    <div className="teams-setup">
      <h2 className="teams-setup__title">Введите имена участников</h2>
      {teamHint != null && (
        <p className="teams-setup__hint" role="status">{teamHint}</p>
      )}
      <div className="teams-setup__list">
        {visibleTeams.map((team, slotIndex) => (
          <div key={slotIndex} className="teams-setup__card alias-page__panel alias-page__panel--glow-a">
            <label className="teams-setup__label">Название команды</label>
            <input
              type="text"
              className="teams-setup__input alias-page__input"
              placeholder={`Команда ${slotIndex + 1}`}
              value={team.name}
              onChange={(e) => handleTeamName(slotIndex, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  ;(e.target as HTMLInputElement).blur()
                }
              }}
              inputMode="text"
              enterKeyHint="done"
              autoCorrect="off"
              autoCapitalize="words"
              maxLength={32}
            />
            <div className="teams-setup__players">
              <span className="teams-setup__players-label">Игроки</span>
              <ul className="teams-setup__player-list">
                {team.players.map((playerName, playerIndex) => (
                  <li key={playerIndex} className="teams-setup__player-item">
                    <span className="teams-setup__player-name">{playerName}</span>
                    <button
                      type="button"
                      className="teams-setup__player-remove"
                      onClick={() => handleRemovePlayer(slotIndex, playerIndex)}
                      aria-label="Удалить"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              <div className="teams-setup__add-row">
                <input
                  ref={(el) => {
                    playerInputRefs.current[slotIndex] = el
                  }}
                  type="text"
                  className="teams-setup__input teams-setup__input--small alias-page__input"
                  placeholder="Имя игрока"
                  value={playerInputs[slotIndex] ?? ''}
                  onChange={(e) => {
                    setPlayerInputs((prev) => {
                      const next = [...prev]
                      next[slotIndex] = e.target.value
                      return next
                    })
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddPlayer(slotIndex)
                    }
                  }}
                  inputMode="text"
                  enterKeyHint="done"
                  autoCorrect="off"
                  autoCapitalize="words"
                />
                <button
                  type="button"
                  className="teams-setup__add-btn"
                  onClick={() => handleAddPlayer(slotIndex)}
                >
                  Добавить
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
