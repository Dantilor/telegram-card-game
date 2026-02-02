import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSabotageGame } from '../games/sabotage/SabotageGameContext'
import { ROLE_LABELS } from '../games/sabotage/types'
import { haptic } from '../utils/telegram'
import { hapticSelection, hapticImpact } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import './SabotageRole.css'

const PASS_DISPLAY_MS = 2000

function SabotageRole() {
  const navigate = useNavigate()
  const { state, dispatch } = useSabotageGame()
  const [phase, setPhase] = useState<'pass' | 'role'>('pass')

  if (!state.players.length) {
    navigate('/sabotage')
    return null
  }

  const player = state.players[state.roleViewIndex]
  const isLast = state.roleViewIndex >= state.players.length - 1

  useEffect(() => {
    setPhase('pass')
    const t = setTimeout(() => setPhase('role'), PASS_DISPLAY_MS)
    return () => clearTimeout(t)
  }, [state.roleViewIndex])

  useEffect(() => {
    if (phase === 'role') {
      hapticImpact('medium')
    }
  }, [phase])

  useEffect(() => {
    if (state.phase === 'task') {
      navigate('/sabotage/task')
    }
  }, [state.phase, navigate])

  const handleNext = () => {
    hapticSelection()
    dispatch({ type: 'NEXT_ROLE_VIEW' })
  }

  const handleBack = () => {
    haptic('light')
    navigate('/sabotage')
  }

  if (!player) {
    navigate('/sabotage')
    return null
  }

  const isSaboteur = player.role === 'saboteur'

  return (
    <div className="sabotage-role">
      <div className="sabotage-role__top">
        <HomeButton />
        <button type="button" className="btn btn--ghost sabotage-role__back" onClick={handleBack}>
          ← В меню
        </button>
      </div>

      <div className={`sabotage-role__card card ${phase === 'role' ? 'sabotage-role__card--reveal' : ''}`}>
        {phase === 'pass' ? (
          <div className="sabotage-role__pass">
            <p className="sabotage-role__pass-label">Передай телефон игроку:</p>
            <h2 className="sabotage-role__pass-name">{player.name}</h2>
          </div>
        ) : (
          <div className={`sabotage-role__reveal ${isSaboteur ? 'sabotage-role__reveal--saboteur' : ''}`}>
            <span className="sabotage-role__emoji" aria-hidden>
              {isSaboteur ? '😈' : '👤'}
            </span>
            <h2 className="sabotage-role__role">{ROLE_LABELS[player.role]}</h2>
            {isSaboteur && (
              <p className="sabotage-role__hint">Мешай аккуратно: сомневайся, отвлекай, усложняй</p>
            )}
          </div>
        )}
      </div>

      {phase === 'role' && (
        <div className="sabotage-role__next">
          <button type="button" className="btn btn--primary sabotage-role__next-btn" onClick={handleNext}>
            {isLast ? 'Начать задание' : 'Готово'}
          </button>
        </div>
      )}

      <p className="sabotage-role__progress">
        {state.roleViewIndex + 1} / {state.players.length}
      </p>
    </div>
  )
}

export default SabotageRole
