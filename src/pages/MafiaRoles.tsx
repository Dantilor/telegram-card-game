import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useMafiaGame } from '../games/mafia/MafiaGameContext'
import { ROLE_LABELS } from '../games/mafia/types'
import { IMAGES } from '../assets/images'
import { useBack } from '../hooks/useBack'
import { hapticSelection, hapticImpact } from '../utils/haptics'
import { trackEvent } from '../lib/analytics'
import HomeButton from '../components/HomeButton'
import './MafiaRoles.css'

const ROLE_DISPLAY_MS = 5000

function MafiaRoles() {
  const navigate = useNavigate()
  const { state, dispatch } = useMafiaGame()
  const [roleRevealed, setRoleRevealed] = useState(false)
  const [roleDimmed, setRoleDimmed] = useState(false)

  if (!state.players.length) {
    navigate('/mafia')
    return null
  }

  const player = state.players[state.roleViewIndex]
  const isLast = state.roleViewIndex >= state.players.length - 1

  useEffect(() => {
    trackEvent('start_game', { gameId: 'mafia' })
  }, [])

  const location = useLocation()
  useEffect(() => {
    if (state.phase === 'night_intro' && location.pathname !== '/mafia/night') {
      navigate('/mafia/night')
    }
  }, [state.phase, location.pathname, navigate])

  useEffect(() => {
    if (roleRevealed) {
      setRoleDimmed(false)
      const t = setTimeout(() => setRoleDimmed(true), ROLE_DISPLAY_MS)
      return () => clearTimeout(t)
    } else {
      setRoleDimmed(false)
    }
  }, [roleRevealed])

  const handleShowRole = () => {
    hapticImpact('medium')
    setRoleRevealed(true)
  }

  const handleNext = () => {
    hapticSelection()
    setRoleRevealed(false)
    setRoleDimmed(false)
    dispatch({ type: 'NEXT_ROLE_VIEW' })
  }

  const handleBack = useBack('/mafia')

  if (!player) {
    navigate('/mafia')
    return null
  }

  const roleLabel = ROLE_LABELS[player.role]
  const roleEmoji = { civilian: '👤', mafia: '🌙', doctor: '💊', sheriff: '⭐' }[player.role]
  const isDoctor = player.role === 'doctor'
  const isMafia = player.role === 'mafia'
  const isSheriff = player.role === 'sheriff'
  const isCivilian = player.role === 'civilian'
  const civilianImg = isCivilian
    ? (player.civilianImageIndex === 1 ? IMAGES.mafiaCivilian2.png : IMAGES.mafiaCivilian1.png)
    : null

  return (
    <div className="mafia-roles">
      <div className="mafia-roles__top">
        <HomeButton />
        <button type="button" className="btn btn--ghost home-btn mafia-roles__back" onClick={handleBack}>
          ← В меню
        </button>
      </div>

      <p className="mafia-roles__progress">Игрок {state.roleViewIndex + 1} / {state.players.length}</p>

      <div className="mafia-roles__card card">
        <h2 className="mafia-roles__player-name">Игрок: {player.name}</h2>
        {roleRevealed ? (
          <div className={`mafia-roles__reveal ${roleDimmed ? 'mafia-roles__reveal--dimmed' : ''}`}>
            <p className="mafia-roles__role mafia-roles__role--above">Твоя роль: {roleLabel}</p>
            <div className="mafia-roles__role-media">
              {isDoctor ? (
                <img src={IMAGES.mafiaDoctor.png} alt="" className="mafia-roles__role-img mafia-roles__role-img--doctor" />
              ) : isMafia ? (
                <img src={IMAGES.mafiaRole.png} alt="" className="mafia-roles__role-img mafia-roles__role-img--mafia" />
              ) : isSheriff ? (
                <img src={IMAGES.mafiaSheriff.png} alt="" className="mafia-roles__role-img mafia-roles__role-img--sheriff" />
              ) : civilianImg ? (
                <img src={civilianImg} alt="" className="mafia-roles__role-img mafia-roles__role-img--civilian" />
              ) : (
                <span className="mafia-roles__emoji" aria-hidden>{roleEmoji}</span>
              )}
            </div>
            <button
              type="button"
              className="btn btn--primary mafia-roles__next-btn"
              onClick={handleNext}
            >
              {isLast ? 'Начать раунд' : 'Передать следующему'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn--primary mafia-roles__show-btn"
            onClick={handleShowRole}
          >
            Показать мою роль
          </button>
        )}
      </div>
    </div>
  )
}

export default MafiaRoles
