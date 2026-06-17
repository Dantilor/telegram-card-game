import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSabotageGame } from '../games/sabotage/SabotageGameContext'
import { ROLE_LABELS } from '../games/sabotage/types'
import { useBack } from '../hooks/useBack'
import { hapticSelection, hapticImpact } from '../utils/haptics'
import { trackEvent } from '../lib/analytics'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
import './SabotageRole.css'

function SabotageRole() {
  const navigate = useNavigate()
  const { state, dispatch } = useSabotageGame()
  const [phase, setPhase] = useState<'pass' | 'role'>('pass')
  const prevPhaseRef = useRef<string | null>(null)

  useEffect(() => {
    if (!state.players.length) {
      navigate('/sabotage')
    }
  }, [state.players.length, navigate])

  const player = state.players[state.roleViewIndex]
  const isLast = state.roleViewIndex >= state.players.length - 1

  const handleNext = () => {
    hapticSelection()
    setPhase('pass')
    dispatch({ type: 'NEXT_ROLE_VIEW' })
  }

  const handleRevealFromPass = () => {
    hapticSelection()
    hapticImpact('medium')
    setPhase('role')
  }

  useEffect(() => {
    trackEvent('start_game', { gameId: 'sabotage' })
  }, [])

  useEffect(() => {
    const prev = prevPhaseRef.current
    prevPhaseRef.current = state.phase
    if (prev != null && prev !== 'task' && state.phase === 'task') {
      navigate('/sabotage/task')
    }
  }, [state.phase, navigate])

  const handleBack = useBack('/sabotage')

  if (!state.players.length) {
    return null
  }

  if (!player) {
    navigate('/sabotage')
    return null
  }

  const isSaboteur = player.role === 'saboteur'

  return (
    <div className="game-page sabotage-role sabotage-flow game-page--enter">
      <div className="game-page__top">
        <HomeButton className="game-page__nav-btn" />
        <BackButton onClick={handleBack} className="game-page__nav-btn game-page__back" />
      </div>

      <p className="game-page__progress">
        Игрок {state.roleViewIndex + 1} / {state.players.length}
      </p>

      <div className="sabotage-role__card game-page__panel game-page__panel--glow-b">
        {phase === 'pass' ? (
          <div className="sabotage-role__pass">
            <p className="sabotage-role__pass-label">Передай телефон игроку:</p>
            <h2 className="sabotage-role__pass-name">{player.name}</h2>
            <button
              type="button"
              className="game-page__cta sabotage-role__show-btn"
              onClick={handleRevealFromPass}
            >
              Показать мою роль
            </button>
          </div>
        ) : (
          <div className={`sabotage-role__reveal ${isSaboteur ? 'sabotage-role__reveal--saboteur' : ''}`}>
            <p className="sabotage-role__player-name">Игрок: {player.name}</p>
            <span className="sabotage-role__emoji" aria-hidden>{isSaboteur ? '😈' : '👤'}</span>
            <h2 className="sabotage-role__role">{ROLE_LABELS[player.role]}</h2>
            {isSaboteur && (
              <p className="sabotage-role__hint-text">Мешай аккуратно: сомневайся, отвлекай, усложняй</p>
            )}
            <button
              type="button"
              className="game-page__cta sabotage-role__next-btn"
              onClick={handleNext}
            >
              {isLast ? 'Начать задание' : 'Передать следующему игроку'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default SabotageRole
