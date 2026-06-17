import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAliasStateContext } from '../games/alias/AliasStateContext'
import { saveAliasState, getInitialAliasState } from '../games/alias/state'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
import GameExitConfirmModal from '../components/GameExitConfirmModal'
import './AliasResult.css'

type ResultState = { guessed: number; skipped: number } | null

function AliasResult() {
  const navigate = useNavigate()
  const location = useLocation()
  const { state, dispatch } = useAliasStateContext()
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const result = (location.state as ResultState) ?? { guessed: 0, skipped: 0 }

  const handleExitConfirm = (confirmed: boolean) => {
    setShowExitConfirm(false)
    if (!confirmed) return
    haptic('light')
    saveAliasState(getInitialAliasState())
    dispatch({ type: 'RESET_ALL' })
    navigate('/games')
  }

  const handleNextRound = () => {
    hapticSelection()
    navigate('/alias/play')
  }

  const handleChangeCategory = () => {
    haptic('light')
    navigate('/alias')
  }

  const handleBack = () => {
    haptic('light')
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/alias')
    }
  }

  return (
    <div className="alias-page alias-result game-page--enter">
      <div className="alias-page__top">
        <HomeButton
          className="alias-page__nav-btn"
          onBeforeNavigate={() => {
            setShowExitConfirm(true)
            return true
          }}
        />
        <BackButton onClick={handleBack} className="alias-page__nav-btn alias-page__back" />
      </div>
      <header className="alias-result__header">
        <h1 className="alias-result__title">Итоги раунда</h1>
      </header>
      <div className="alias-result__stats alias-page__panel alias-page__panel--glow-a">
        <div className="alias-result__stat">
          <span className="alias-result__stat-value">{result.guessed}</span>
          <span className="alias-result__stat-label">Угадано</span>
        </div>
        <div className="alias-result__stat">
          <span className="alias-result__stat-value">{result.skipped}</span>
          <span className="alias-result__stat-label">Пропущено</span>
        </div>
      </div>
      {state.mode === 'team' && (
        <div className="alias-result__scores alias-page__panel alias-page__panel--glow-b">
          <h2 className="alias-result__scores-title">Счёт</h2>
          <p className="alias-result__scores-text">
            A: {state.scores.teamA} — B: {state.scores.teamB}
          </p>
        </div>
      )}
      <div className="alias-result__actions">
        <button
          type="button"
          className="alias-page__cta"
          onClick={handleNextRound}
        >
          Следующий раунд
        </button>
        <button
          type="button"
          className="alias-page__btn alias-page__btn--secondary"
          onClick={handleChangeCategory}
        >
          Сменить категорию
        </button>
      </div>

      {showExitConfirm && (
        <GameExitConfirmModal
          hint="Если выйти, весь прогресс будет сброшен (команды, счёт, раунд, выбранные настройки)."
          onCancel={() => handleExitConfirm(false)}
          onConfirm={() => handleExitConfirm(true)}
        />
      )}
    </div>
  )
}

export default AliasResult
