import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAliasState } from '../games/alias/useAliasState'
import { getCategoryById, shuffleFisherYates } from '../games/alias/data/words'
import { haptic } from '../utils/telegram'
import { hapticSelection, hapticSuccess } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import './AliasPlay.css'

const FINISH_OVERLAY_MS = 750

function AliasPlay() {
  const navigate = useNavigate()
  const [state, setState] = useAliasState()
  const [currentTeam, setCurrentTeam] = useState<'A' | 'B'>(state.lastPlayedTeam === 'B' ? 'A' : 'B')
  const [guessed, setGuessed] = useState(0)
  const [skipped, setSkipped] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState<number>(state.timerSeconds)
  const [isPaused, setIsPaused] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [showReshuffleToast, setShowReshuffleToast] = useState(false)
  const [showFinishOverlay, setShowFinishOverlay] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isFinishedRef = useRef(false)
  const finishOverlayShownRef = useRef(false)
  const endAtRef = useRef<number>(0)
  const secondsLeftRef = useRef(secondsLeft)
  const guessedRef = useRef(0)
  const skippedRef = useRef(0)
  const currentTeamRef = useRef<'A' | 'B'>(state.lastPlayedTeam === 'B' ? 'A' : 'B')

  guessedRef.current = guessed
  skippedRef.current = skipped
  currentTeamRef.current = currentTeam
  secondsLeftRef.current = secondsLeft

  const category = state.categoryId ? getCategoryById(state.categoryId) : null
  const currentWord = state.bag.length > 0 ? state.bag[state.bagIdx] ?? null : null

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const finishRound = useCallback(() => {
    if (isFinishedRef.current) return
    isFinishedRef.current = true
    clearTimer()
    const g = guessedRef.current
    const sk = skippedRef.current
    const team = currentTeamRef.current
    setState((prev) => ({
      ...prev,
      lastPlayedTeam: state.mode === 'team' ? team : null,
    }))
    navigate('/alias/result', { state: { guessed: g, skipped: sk } })
  }, [clearTimer, state.mode, setState, navigate])

  useEffect(() => {
    if (!state.bag.length || !currentWord) {
      navigate('/alias')
      return
    }
    setSecondsLeft(state.timerSeconds)
    setIsPaused(false)
    endAtRef.current = Date.now() + state.timerSeconds * 1000
    return () => clearTimer()
  }, [])

  useEffect(() => {
    if (isPaused || !currentWord || secondsLeft <= 0) return
    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000))
      if (remaining <= 0) {
        clearTimer()
        setSecondsLeft(0)
      } else {
        setSecondsLeft(remaining)
      }
    }, 250)
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isPaused, clearTimer])

  useEffect(() => {
    if (secondsLeft !== 0 || !currentWord || finishOverlayShownRef.current) return
    finishOverlayShownRef.current = true
    setShowFinishOverlay(true)
    const t = setTimeout(() => {
      finishRound()
    }, FINISH_OVERLAY_MS)
    return () => clearTimeout(t)
  }, [secondsLeft, currentWord, finishRound])

  const handleGuessed = () => {
    hapticSuccess()
    setGuessed((g) => g + 1)
    if (state.mode === 'team') {
      setState((prev) => ({
        ...prev,
        scores: {
          ...prev.scores,
          [currentTeam === 'A' ? 'teamA' : 'teamB']: (prev.scores[currentTeam === 'A' ? 'teamA' : 'teamB'] ?? 0) + 1,
        },
      }))
    }
    nextWord()
  }

  const handleSkip = () => {
    haptic('light')
    setSkipped((s) => s + 1)
    nextWord()
  }

  const nextWord = () => {
    const nextIdx = state.bagIdx + 1
    if (nextIdx >= state.bag.length) {
      const cat = category
      if (cat) {
        const newBag = shuffleFisherYates(cat.words)
        setState((prev) => ({
          ...prev,
          bag: newBag,
          bagIdx: 0,
        }))
        setShowReshuffleToast(true)
        setTimeout(() => setShowReshuffleToast(false), 2500)
      }
    } else {
      setState((prev) => ({ ...prev, bagIdx: nextIdx }))
    }
  }

  const handlePause = () => {
    hapticSelection()
    const remaining = secondsLeftRef.current ?? secondsLeft
    setIsPaused((p) => {
      if (!p && remaining > 0) {
        endAtRef.current = Date.now() + remaining * 1000
      }
      return !p
    })
  }

  const handleNextWordOrRound = () => {
    haptic('light')
    if (secondsLeft <= 0) {
      finishRound()
    } else {
      setSkipped((s) => s + 1)
      nextWord()
    }
  }

  const handleBack = () => {
    if (guessed > 0 || skipped > 0) {
      setShowExitConfirm(true)
    } else {
      haptic('light')
      navigate('/alias')
    }
  }

  const handleExitConfirm = (confirm: boolean) => {
    if (confirm) navigate('/alias')
    setShowExitConfirm(false)
  }

  const handlePassTurn = () => {
    hapticSelection()
    setCurrentTeam((t) => (t === 'A' ? 'B' : 'A'))
  }

  if (!category || !currentWord) {
    return (
      <div className="alias-play">
        <p className="alias-play__message">Загрузка…</p>
      </div>
    )
  }

  const progressPercent = (secondsLeft / state.timerSeconds) * 100
  const isLowTime = secondsLeft <= 5 && secondsLeft > 0

  return (
    <div className="alias-play">
      <div className="alias-play__top">
        <button type="button" className="btn btn--ghost alias-play__back" onClick={handleBack}>
          ← Назад
        </button>
        <HomeButton />
      </div>

      <div className="alias-play__timer-wrap">
        <div
          className={`alias-play__timer-bar ${isLowTime ? 'alias-play__timer-bar--pulse' : ''}`}
          style={{ width: `${progressPercent}%` }}
        />
        <span className="alias-play__timer-text">{secondsLeft} сек</span>
        <button
          type="button"
          className="btn btn--ghost alias-play__pause"
          onClick={handlePause}
        >
          {isPaused ? '▶' : '⏸'}
        </button>
      </div>

      {state.mode === 'team' && (
        <div className="alias-play__teams">
          <span className={`alias-play__team ${currentTeam === 'A' ? 'alias-play__team--active' : ''}`}>
            A: {state.scores.teamA}
          </span>
          <span className={`alias-play__team ${currentTeam === 'B' ? 'alias-play__team--active' : ''}`}>
            B: {state.scores.teamB}
          </span>
        </div>
      )}

      <div className="alias-play__word-card card">
        <p className="alias-play__word">{currentWord}</p>
      </div>

      <div className="alias-play__actions">
        <button
          type="button"
          className="btn btn--primary alias-play__btn alias-play__btn--guess"
          onClick={handleGuessed}
        >
          ✅ Угадали
        </button>
        <button
          type="button"
          className="btn btn--ghost alias-play__btn"
          onClick={handleSkip}
        >
          ⏭️ Пропуск
        </button>
      </div>

      <div className="alias-play__footer">
        <button
          type="button"
          className="btn btn--secondary alias-play__next-round"
          onClick={handleNextWordOrRound}
        >
          {secondsLeft <= 0 ? 'Следующий раунд' : 'Следующее слово'}
        </button>
        {state.mode === 'team' && (
          <button
            type="button"
            className="btn btn--ghost alias-play__pass"
            onClick={handlePassTurn}
          >
            Передать ход
          </button>
        )}
      </div>

      {showReshuffleToast && (
        <div className="alias-play__toast">
          Слова закончились — начинаем заново
        </div>
      )}

      {showFinishOverlay && (
        <div className="alias-finish-overlay">
          <div className="alias-finish-overlay__card card">
            <h2 className="alias-finish-overlay__title">Время вышло!</h2>
          </div>
        </div>
      )}

      {showExitConfirm && (
        <div className="alias-play__modal-overlay" onClick={() => handleExitConfirm(false)}>
          <div className="alias-play__modal card" onClick={(e) => e.stopPropagation()}>
            <p>Выйти из раунда? Прогресс не сохранится.</p>
            <div className="alias-play__modal-btns">
              <button type="button" className="btn btn--ghost" onClick={() => handleExitConfirm(false)}>
                Отмена
              </button>
              <button type="button" className="btn btn--danger" onClick={() => handleExitConfirm(true)}>
                Выйти
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AliasPlay
