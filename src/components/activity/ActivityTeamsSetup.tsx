import { useState, useRef } from 'react'
import type { ActivityTeamSlot } from '../../games/activity/types'
import type { ActivityAction } from '../../games/activity/reducer'
import { haptic } from '../../utils/telegram'
import { hapticSelection } from '../../utils/haptics'
import './ActivityTeamsSetup.css'

type Props = {
  teamCount: number
  teams: ActivityTeamSlot[]
  dispatch: (action: ActivityAction) => void
  teamHint?: string | null
}

export function ActivityTeamsSetup({ teamCount, teams, dispatch, teamHint }: Props) {
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
    <div className="activity-teams-setup">
      <h2 className="activity-teams-setup__title">Введите имена участников</h2>
      {teamHint != null && (
        <p className="activity-teams-setup__section-hint" role="status">{teamHint}</p>
      )}
      <div className="activity-teams-setup__list">
        {visibleTeams.map((team, slotIndex) => (
          <div key={slotIndex} className="activity-teams-setup__card game-page__panel game-page__panel--glow-a">
            <label className="activity-teams-setup__label">Название команды</label>
            <input
              type="text"
              className="activity-teams-setup__input game-page__input"
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
            <div className="activity-teams-setup__players">
              <span className="activity-teams-setup__players-label">
                Игроки {team.players.length < 2 && <span className="activity-teams-setup__hint">(минимум 2)</span>}
              </span>
              <ul className="activity-teams-setup__player-list">
                {team.players.map((playerName, playerIndex) => (
                  <li key={playerIndex} className="activity-teams-setup__player-item">
                    <span className="activity-teams-setup__player-name">{playerName}</span>
                    <button
                      type="button"
                      className="activity-teams-setup__player-remove"
                      onClick={() => handleRemovePlayer(slotIndex, playerIndex)}
                      aria-label="Удалить"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              <div className="activity-teams-setup__add-row">
                <input
                  ref={(el) => {
                    playerInputRefs.current[slotIndex] = el
                  }}
                  type="text"
                  className="activity-teams-setup__input activity-teams-setup__input--small game-page__input"
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
                  className="activity-teams-setup__add-btn"
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
