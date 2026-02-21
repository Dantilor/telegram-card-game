import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAliasStateContext } from '../games/alias/AliasStateContext'
import { saveAliasState, getInitialAliasState } from '../games/alias/state'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
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

  return (
    <div className="alias-result">
      <div className="alias-result__top">
        <HomeButton
          onBeforeNavigate={() => {
            setShowExitConfirm(true)
            return true
          }}
        />
        <button
          type="button"
          className="btn btn--ghost alias-result__back"
          onClick={() => { haptic('light'); window.history.length > 1 ? navigate(-1) : navigate('/alias') }}
        >
          ← Назад
        </button>
      </div>
      <header className="alias-result__header">
        <h1 className="alias-result__title">Итоги раунда</h1>
      </header>
      <div className="alias-result__stats card">
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
        <div className="alias-result__scores card">
          <h2 className="alias-result__scores-title">Счёт</h2>
          <p className="alias-result__scores-text">
            A: {state.scores.teamA} — B: {state.scores.teamB}
          </p>
        </div>
      )}
      <div className="alias-result__actions">
        <button
          type="button"
          className="btn btn--primary alias-result__btn"
          onClick={handleNextRound}
        >
          Следующий раунд
        </button>
        <button
          type="button"
          className="btn btn--ghost alias-result__btn"
          onClick={handleChangeCategory}
        >
          Сменить категорию
        </button>
      </div>

      {showExitConfirm && (
        <div
          className="alias-result__modal-overlay"
          onClick={() => handleExitConfirm(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="alias-result-exit-title"
        >
          <div className="alias-result__modal card" onClick={(e) => e.stopPropagation()}>
            <p id="alias-result-exit-title" className="alias-result__modal-text">Выйти из игры?</p>
            <p className="alias-result__modal-hint">
              Если выйти, весь прогресс будет сброшен (команды, счёт, раунд, выбранные настройки).
            </p>
            <div className="alias-result__modal-buttons">
              <button type="button" className="btn btn--ghost" onClick={() => handleExitConfirm(false)}>
                Остаться
              </button>
              <button type="button" className="btn btn--primary" onClick={() => handleExitConfirm(true)}>
                Выйти
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AliasResult
