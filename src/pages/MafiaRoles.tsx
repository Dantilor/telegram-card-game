import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMafiaGame } from '../games/mafia/MafiaGameContext'
import { ROLE_LABELS } from '../games/mafia/types'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import './MafiaRoles.css'

const ROLE_DISPLAY_MS = 5000

function MafiaRoles() {
  const navigate = useNavigate()
  const { state, dispatch } = useMafiaGame()
  const [showRole, setShowRole] = useState(true)

  if (!state.players.length) {
    navigate('/mafia')
    return null
  }

  const player = state.players[state.roleViewIndex]
  const isLast = state.roleViewIndex >= state.players.length - 1

  useEffect(() => {
    setShowRole(true)
    const t = setTimeout(() => setShowRole(false), ROLE_DISPLAY_MS)
    return () => clearTimeout(t)
  }, [state.roleViewIndex])

  useEffect(() => {
    if (state.phase === 'night_intro') {
      navigate('/mafia/night')
    }
  }, [state.phase, navigate])

  const handleNext = () => {
    hapticSelection()
    dispatch({ type: 'NEXT_ROLE_VIEW' })
  }

  const handleBack = () => {
    haptic('light')
    navigate('/mafia')
  }

  if (!player) {
    navigate('/mafia')
    return null
  }

  const roleLabel = ROLE_LABELS[player.role]
  const roleEmoji = { civilian: '👤', mafia: '🌙', doctor: '💊', sheriff: '⭐' }[player.role]

  return (
    <div className="mafia-roles">
      <div className="mafia-roles__top">
        <HomeButton />
        <button type="button" className="btn btn--ghost mafia-roles__back" onClick={handleBack}>
          ← В меню
        </button>
      </div>

      <div className={`mafia-roles__card card ${!showRole ? 'mafia-roles__card--dimmed' : ''}`}>
        <p className="mafia-roles__player">Игрок: {player.name}</p>
        {showRole ? (
          <>
            <span className="mafia-roles__emoji" aria-hidden>{roleEmoji}</span>
            <h2 className="mafia-roles__role">{roleLabel}</h2>
          </>
        ) : (
          <div className="mafia-roles__pass">
            <p className="mafia-roles__pass-text">Передай следующему</p>
            <button
              type="button"
              className="btn btn--primary mafia-roles__pass-btn"
              onClick={handleNext}
            >
              {isLast ? 'Начать игру' : 'Готово'}
            </button>
          </div>
        )}
      </div>

      <p className="mafia-roles__hint">
        {state.roleViewIndex + 1} / {state.players.length}
      </p>
    </div>
  )
}

export default MafiaRoles
