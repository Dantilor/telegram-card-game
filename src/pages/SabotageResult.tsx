import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSabotageGame } from '../games/sabotage/SabotageGameContext'
import { haptic } from '../utils/telegram'
import { hapticSelection, hapticImpact } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
import './SabotageResult.css'

const REVEAL_DELAY_MS = 1200

function SabotageResult() {
  const navigate = useNavigate()
  const { state, dispatch } = useSabotageGame()
  const [showReveal, setShowReveal] = useState(false)

  const isTeamWin = state.winner === 'team'
  const saboteur = state.players.find((p) => p.id === state.saboteurId)

  useEffect(() => {
    const t = setTimeout(() => {
      setShowReveal(true)
      hapticImpact('medium')
    }, REVEAL_DELAY_MS)
    return () => clearTimeout(t)
  }, [])

  const handlePlayAgain = () => {
    hapticSelection()
    dispatch({ type: 'START_NEXT_ROUND' })
    navigate('/sabotage/role')
  }

  const handleBackToGames = () => {
    haptic('light')
    dispatch({ type: 'RESET' })
    navigate('/games')
  }

  return (
    <div className="game-page sabotage-result game-page--enter">
      <div className="game-page__top">
        <HomeButton className="game-page__nav-btn" />
        <BackButton onClick={() => navigate('/sabotage')} className="game-page__nav-btn game-page__back" />
      </div>

      <div className={`sabotage-result__card game-page__panel game-page__panel--glow-b ${showReveal ? 'sabotage-result__card--reveal' : ''}`}>
        {!showReveal ? (
          <div className="sabotage-result__wait">
            <span className="sabotage-result__wait-emoji" aria-hidden>😏</span>
            <p className="sabotage-result__wait-text">Раскрываем...</p>
          </div>
        ) : (
          <>
            <h1 className={`sabotage-result__title ${isTeamWin ? 'sabotage-result__title--team' : 'sabotage-result__title--saboteur'}`}>
              {isTeamWin ? 'Команда победила!' : 'Саботёр победил!'}
            </h1>
            {saboteur && (
              <div className="sabotage-result__saboteur">
                <p className="sabotage-result__saboteur-label">Саботёр:</p>
                <p className="sabotage-result__saboteur-name">{saboteur.name}</p>
              </div>
            )}
          </>
        )}
      </div>

      {showReveal && (
        <div className="sabotage-result__actions">
          <button
            type="button"
            className="game-page__cta"
            onClick={handlePlayAgain}
          >
            Сыграть ещё раз
          </button>
          <button
            type="button"
            className="game-page__btn game-page__btn--secondary"
            onClick={handleBackToGames}
          >
            В меню игр
          </button>
        </div>
      )}
    </div>
  )
}

export default SabotageResult
