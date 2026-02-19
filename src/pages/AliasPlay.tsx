import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAliasState } from '../games/alias/useAliasState'
import { getWordsByCategoryIds, shuffleFisherYates } from '../games/alias/data/words'
import { getCurrentTeam, getCurrentTeamSlotIndex } from '../games/alias/types'
import { haptic } from '../utils/telegram'
import { hapticSelection, hapticSuccess } from '../utils/haptics'
import { trackEvent } from '../lib/analytics'
import HomeButton from '../components/HomeButton'
import './AliasPlay.css'

const TICK_MS = 250

function AliasPlay() {
  const navigate = useNavigate()
  const [state, setState, dispatch] = useAliasState()

  // --- Team mode: branch by phase ---
  if (state.mode === 'team') {
    if (state.phase === 'setup') {
      navigate('/alias/setup', { replace: true })
      return (
        <div className="alias-play">
          <p className="alias-play__message">Переход…</p>
        </div>
      )
    }
    if (state.phase === 'turn_ready') {
      return (
        <TeamTurnReadyScreen
          state={state}
          dispatch={dispatch}
          onBack={() => navigate('/alias')}
        />
      )
    }
    if (state.phase === 'in_round') {
      return (
        <TeamInRoundScreen
          state={state}
          dispatch={dispatch}
          onBack={() => navigate('/alias')}
        />
      )
    }
    if (state.phase === 'round_results') {
      return (
        <TeamRoundResultsScreen
          state={state}
          dispatch={dispatch}
          onBack={() => navigate('/alias')}
        />
      )
    }
  }

  // --- Solo mode (legacy) ---
  return (
    <SoloPlayScreen state={state} setState={setState} navigate={navigate} />
  )
}

function TeamTurnReadyScreen({
  state,
  dispatch,
  onBack,
}: {
  state: import('../games/alias/types').AliasState
  dispatch: (a: import('../games/alias/reducer').AliasAction) => void
  onBack: () => void
}) {
  const team = getCurrentTeam(state)
  const hostName =
    team && team.players.length > 0
      ? team.players[team.activePlayerIndex % team.players.length] ?? team.players[0]
      : '—'

  return (
    <div className="alias-play">
      <div className="alias-play__top">
        <button type="button" className="btn btn--ghost alias-play__back" onClick={onBack}>
          ← Назад
        </button>
        <HomeButton />
      </div>
      <header className="alias-play__turn-ready">
        <h1 className="alias-play__turn-title">Ход: {team?.name.trim() || '—'}</h1>
        <p className="alias-play__turn-host">Ведущий: {hostName}</p>
      </header>
      <div className="alias-play__turn-actions">
        <button
          type="button"
          className="btn btn--ghost alias-play__btn"
          onClick={() => {
            hapticSelection()
            dispatch({ type: 'NEXT_HOST' })
          }}
        >
          Следующий ведущий
        </button>
        <button
          type="button"
          className="btn btn--primary alias-play__btn"
          onClick={() => {
            haptic('medium')
            dispatch({ type: 'START_ROUND' })
          }}
        >
          Начать раунд
        </button>
      </div>
    </div>
  )
}

function TeamInRoundScreen({
  state,
  dispatch,
  onBack,
}: {
  state: import('../games/alias/types').AliasState
  dispatch: (a: import('../games/alias/reducer').AliasAction) => void
  onBack: () => void
}) {
  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (state.roundEndsAt == null) return state.timerSeconds
    return Math.max(0, Math.ceil((state.roundEndsAt - Date.now()) / 1000))
  })
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const endFiredRef = useRef(false)

  const currentWord =
    state.bag.length > 0 ? (state.bag[state.bagIdx] ?? null) : null

  useEffect(() => {
    if (state.phase !== 'in_round' || state.roundEndsAt == null) return
    endFiredRef.current = false
    intervalRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((state.roundEndsAt! - Date.now()) / 1000))
      setSecondsLeft(remaining)
      if (remaining <= 0 && !endFiredRef.current) {
        endFiredRef.current = true
        dispatch({ type: 'END_ROUND' })
      }
    }, TICK_MS)
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [state.phase, state.roundEndsAt, dispatch])

  const progressPercent =
    state.timerSeconds > 0 ? (secondsLeft / state.timerSeconds) * 100 : 0
  const isLowTime = secondsLeft <= 5 && secondsLeft > 0
  const team = getCurrentTeam(state)

  if (!currentWord) {
    return (
      <div className="alias-play">
        <p className="alias-play__message">Загрузка…</p>
      </div>
    )
  }

  return (
    <div className="alias-play">
      <div className="alias-play__top">
        <button type="button" className="btn btn--ghost alias-play__back" onClick={onBack}>
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
      </div>
      {team && (
        <div className="alias-play__teams">
          <span className="alias-play__team alias-play__team--active">
            {team.name.trim()}: {state.teamScores[getCurrentTeamSlotIndex(state)] ?? 0}
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
          onClick={() => {
            hapticSuccess()
            dispatch({ type: 'GUESSED' })
          }}
        >
          ✅ Угадали
        </button>
        <button
          type="button"
          className="btn btn--ghost alias-play__btn"
          onClick={() => {
            haptic('light')
            dispatch({ type: 'SKIPPED' })
          }}
        >
          ⏭️ Пропуск
        </button>
      </div>
    </div>
  )
}

function TeamRoundResultsScreen({
  state,
  dispatch,
  onBack,
}: {
  state: import('../games/alias/types').AliasState
  dispatch: (a: import('../games/alias/reducer').AliasAction) => void
  onBack: () => void
}) {
  const team = getCurrentTeam(state)
  const score = team ? (state.teamScores[getCurrentTeamSlotIndex(state)] ?? 0) : 0

  return (
    <div className="alias-play alias-play--results">
      <div className="alias-play__top">
        <button type="button" className="btn btn--ghost alias-play__back" onClick={onBack}>
          ← Назад
        </button>
        <HomeButton />
      </div>
      <header className="alias-play__results-header">
        <h1 className="alias-play__results-title">Итоги раунда</h1>
      </header>
      <div className="alias-play__results-stats card">
        <div className="alias-play__results-stat">
          <span className="alias-play__results-value">{state.guessed}</span>
          <span className="alias-play__results-label">Угадано</span>
        </div>
        <div className="alias-play__results-stat">
          <span className="alias-play__results-value">{state.skipped}</span>
          <span className="alias-play__results-label">Пропущено</span>
        </div>
      </div>
      <div className="alias-play__results-score card">
        Очки команды «{team?.name.trim() ?? '—'}»: {score}
      </div>
      <div className="alias-play__results-actions">
        <button
          type="button"
          className="btn btn--primary alias-play__btn"
          onClick={() => {
            hapticSelection()
            dispatch({ type: 'PASS_TURN' })
          }}
        >
          Передать ход
        </button>
      </div>
    </div>
  )
}

// --- Solo (legacy) flow ---
const FINISH_OVERLAY_MS = 750

function SoloPlayScreen({
  state,
  setState,
  navigate,
}: {
  state: import('../games/alias/types').AliasState
  setState: (v: import('../games/alias/types').AliasState | ((p: import('../games/alias/types').AliasState) => import('../games/alias/types').AliasState)) => void
  navigate: (path: string, opts?: { state?: { guessed: number; skipped: number } }) => void
}) {
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
    trackEvent('start_game', { gameId: 'alias' })
  }, [])

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
    }, TICK_MS)
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
    setState((prev) => ({
      ...prev,
      scores: {
        ...prev.scores,
        [currentTeam === 'A' ? 'teamA' : 'teamB']: (prev.scores[currentTeam === 'A' ? 'teamA' : 'teamB'] ?? 0) + 1,
      },
    }))
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
      if (state.categoryIds.length > 0) {
        const words = getWordsByCategoryIds(state.categoryIds)
        if (words.length > 0) {
          const newBag = shuffleFisherYates(words)
          setState((prev) => ({ ...prev, bag: newBag, bagIdx: 0 }))
          setShowReshuffleToast(true)
          setTimeout(() => setShowReshuffleToast(false), 2500)
        }
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

  if (state.bag.length === 0 || !currentWord) {
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
        <button type="button" className="btn btn--ghost alias-play__pause" onClick={handlePause}>
          {isPaused ? '▶' : '⏸'}
        </button>
      </div>
      <div className="alias-play__teams">
        <span className={`alias-play__team ${currentTeam === 'A' ? 'alias-play__team--active' : ''}`}>
          A: {state.scores.teamA}
        </span>
        <span className={`alias-play__team ${currentTeam === 'B' ? 'alias-play__team--active' : ''}`}>
          B: {state.scores.teamB}
        </span>
      </div>
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
        <button type="button" className="btn btn--ghost alias-play__btn" onClick={handleSkip}>
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
        <button type="button" className="btn btn--ghost alias-play__pass" onClick={handlePassTurn}>
          Передать ход
        </button>
      </div>
      {showReshuffleToast && (
        <div className="alias-play__toast">Слова закончились — начинаем заново</div>
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
