import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useActivityStateContext } from '../games/activity/ActivityStateContext'
import { saveActivityState, getInitialActivityState } from '../games/activity/state'
import { getCurrentTeam, getCurrentTeamSlotIndex } from '../games/activity/types'
import { TASK_LABELS } from '../games/activity/types'
import { haptic } from '../utils/telegram'
import { hapticSelection, hapticSuccess } from '../utils/haptics'
import { trackEvent } from '../lib/analytics'
import HomeButton from '../components/HomeButton'
import './ActivityPlay.css'

const TICK_MS = 250

function ActivityExitModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <div className="activity-play__modal-overlay" onClick={onClose}>
      <div className="activity-play__modal card" onClick={(e) => e.stopPropagation()}>
        <p className="activity-play__modal-text">Выйти из игры?</p>
        <p className="activity-play__modal-hint">
          Если выйти, весь прогресс будет сброшен.
        </p>
        <div className="activity-play__modal-btns">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Остаться
          </button>
          <button type="button" className="btn btn--primary" onClick={onConfirm}>
            Выйти
          </button>
        </div>
      </div>
    </div>
  )
}

function ActivityRedirectToHome({ onNavigate }: { onNavigate: () => void }) {
  const didRedirect = useRef(false)

  useEffect(() => {
    if (didRedirect.current) return
    didRedirect.current = true
    onNavigate()
  }, [onNavigate])

  return (
    <div className="activity-play">
      <p className="activity-play__message">Переход…</p>
    </div>
  )
}

function ActivityPlay() {
  const navigate = useNavigate()
  const { state, dispatch } = useActivityStateContext()
  const [showExitConfirm, setShowExitConfirm] = useState<'home' | 'back' | null>(null)

  useEffect(() => {
    trackEvent('start_game', { gameId: 'activity' })
  }, [])

  const onBeforeHomeNavigate = () => {
    setShowExitConfirm('home')
    return true
  }

  const onBack = () => {
    setShowExitConfirm('back')
  }

  const handleExitConfirm = (confirmed: boolean) => {
    const target = showExitConfirm
    setShowExitConfirm(null)
    if (!confirmed) return
    haptic('light')
    const initialState = getInitialActivityState()
    saveActivityState(initialState)
    dispatch({ type: 'RESET_ALL' })
    if (target === 'home') {
      navigate('/')
    } else {
      navigate('/activity')
    }
  }

  return (
    <>
      {state.phase === 'setup' && (
        <ActivityRedirectToHome onNavigate={() => navigate('/activity', { replace: true })} />
      )}
      {state.phase === 'turn_ready' && (
        <TeamTurnReadyScreen
          state={state}
          dispatch={dispatch}
          onBack={onBack}
          onBeforeHomeNavigate={onBeforeHomeNavigate}
        />
      )}
      {state.phase === 'in_round' && (
        <TeamInRoundScreen
          state={state}
          dispatch={dispatch}
          onBack={onBack}
          onBeforeHomeNavigate={onBeforeHomeNavigate}
        />
      )}
      {state.phase === 'round_results' && (
        <TeamRoundResultsScreen
          state={state}
          dispatch={dispatch}
          onBack={onBack}
          onBeforeHomeNavigate={onBeforeHomeNavigate}
        />
      )}
      {state.phase === 'game_over' && (
        <ActivityRedirectToHome onNavigate={() => navigate('/activity/result', { replace: true })} />
      )}
      {showExitConfirm != null && (
        <ActivityExitModal
          onClose={() => handleExitConfirm(false)}
          onConfirm={() => handleExitConfirm(true)}
        />
      )}
    </>
  )
}

function TeamTurnReadyScreen({
  state,
  dispatch,
  onBack,
  onBeforeHomeNavigate,
}: {
  state: import('../games/activity/types').ActivityState
  dispatch: (a: import('../games/activity/reducer').ActivityAction) => void
  onBack: () => void
  onBeforeHomeNavigate?: () => boolean
}) {
  const team = getCurrentTeam(state)
  const teamIndex = state.currentTeamIndex + 1
  const totalTeams = state.activeTeamSlots.length

  return (
    <div className="activity-play">
      <div className="activity-play__top">
        <button type="button" className="btn btn--ghost activity-play__back" onClick={onBack}>
          ← Назад
        </button>
        <HomeButton onBeforeNavigate={onBeforeHomeNavigate} />
      </div>

      <div className="activity-play__score-bar">
        <span className="activity-play__score-item">Раунд: {state.roundNumber}</span>
        <span className="activity-play__score-item">Команда: {teamIndex}/{totalTeams}</span>
      </div>

      <header className="activity-play__turn-ready">
        <h1 className="activity-play__turn-title">Ход команды</h1>
        <p className="activity-play__team-name">{team?.name.trim() || '—'}</p>
      </header>

      <div className="activity-play__turn-info card">
        <p className="activity-play__turn-timer">Время раунда: {state.timerSeconds} сек</p>
        <p className="activity-play__turn-hint">
          За это время нужно угадать как можно больше слов
        </p>
      </div>

      <div className="activity-play__turn-actions">
        <button
          type="button"
          className="btn btn--primary activity-play__btn"
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
  onBeforeHomeNavigate,
}: {
  state: import('../games/activity/types').ActivityState
  dispatch: (a: import('../games/activity/reducer').ActivityAction) => void
  onBack: () => void
  onBeforeHomeNavigate?: () => boolean
}) {
  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (state.roundEndsAt == null) return state.timerSeconds
    return Math.max(0, Math.ceil((state.roundEndsAt - Date.now()) / 1000))
  })
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const endFiredRef = useRef(false)
  const [cardKey, setCardKey] = useState(0)

  const team = getCurrentTeam(state)
  const slotIdx = getCurrentTeamSlotIndex(state)
  const currentScore = state.teamScores[slotIdx] ?? 0

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

  const handleGuessed = () => {
    hapticSuccess()
    dispatch({ type: 'GUESSED' })
    setCardKey((k) => k + 1)
  }

  const handleSkip = () => {
    haptic('light')
    dispatch({ type: 'SKIPPED' })
    setCardKey((k) => k + 1)
  }

  return (
    <div className="activity-play">
      <div className="activity-play__top">
        <button type="button" className="btn btn--ghost activity-play__back" onClick={onBack}>
          ← Назад
        </button>
        <HomeButton onBeforeNavigate={onBeforeHomeNavigate} />
      </div>

      <div className="activity-play__score-bar">
        <span className="activity-play__score-item activity-play__score-item--highlight">
          Счёт: {currentScore}
        </span>
        <span className="activity-play__score-item">
          {team?.name.trim() || '—'}
        </span>
      </div>

      <div className="activity-play__timer-wrap">
        <div
          className={`activity-play__timer-bar ${isLowTime ? 'activity-play__timer-bar--pulse' : ''}`}
          style={{ width: `${progressPercent}%` }}
        />
        <span className="activity-play__timer-text">{secondsLeft} сек</span>
      </div>

      <div key={cardKey} className="activity-play__card card">
        <h2 className="activity-play__task">{TASK_LABELS[state.currentTaskType]}</h2>
        <p className="activity-play__word">{state.currentWord}</p>
      </div>

      <div className="activity-play__actions">
        <button
          type="button"
          className="btn btn--primary activity-play__btn activity-play__btn--guess"
          onClick={handleGuessed}
        >
          ✅ Угадали
        </button>
        <button
          type="button"
          className="btn btn--ghost activity-play__btn"
          onClick={handleSkip}
        >
          ⏭️ Пропуск
        </button>
      </div>

      <div className="activity-play__footer">
        <button
          type="button"
          className="btn btn--ghost activity-play__exit"
          onClick={onBack}
        >
          Выйти из игры
        </button>
      </div>
    </div>
  )
}

function TeamRoundResultsScreen({
  state,
  dispatch,
  onBack,
  onBeforeHomeNavigate,
}: {
  state: import('../games/activity/types').ActivityState
  dispatch: (a: import('../games/activity/reducer').ActivityAction) => void
  onBack: () => void
  onBeforeHomeNavigate?: () => boolean
}) {
  const team = getCurrentTeam(state)
  const slotIdx = getCurrentTeamSlotIndex(state)
  const roundScore = state.guessed
  const totalScore = state.teamScores[slotIdx] ?? 0
  const isLastTeam = state.currentTeamIndex >= state.activeTeamSlots.length - 1

  const handleNext = () => {
    hapticSelection()
    dispatch({ type: 'PASS_TURN' })
  }

  return (
    <div className="activity-play activity-play--results">
      <div className="activity-play__top">
        <button type="button" className="btn btn--ghost activity-play__back" onClick={onBack}>
          ← Назад
        </button>
        <HomeButton onBeforeNavigate={onBeforeHomeNavigate} />
      </div>

      <header className="activity-play__results-header">
        <h1 className="activity-play__results-title">Время вышло!</h1>
        <p className="activity-play__results-team">{team?.name.trim() || '—'}</p>
      </header>

      <div className="activity-play__results-stats card">
        <div className="activity-play__results-stat">
          <span className="activity-play__results-value">{roundScore}</span>
          <span className="activity-play__results-label">Угадано за раунд</span>
        </div>
        <div className="activity-play__results-stat">
          <span className="activity-play__results-value">{state.skipped}</span>
          <span className="activity-play__results-label">Пропущено</span>
        </div>
      </div>

      <div className="activity-play__results-total card">
        <span className="activity-play__results-total-label">Всего очков:</span>
        <span className="activity-play__results-total-value">{totalScore}</span>
      </div>

      <div className="activity-play__results-actions">
        <button
          type="button"
          className="btn btn--primary activity-play__btn"
          onClick={handleNext}
        >
          {isLastTeam ? 'Показать результаты' : 'Ход следующей команды'}
        </button>
      </div>
    </div>
  )
}

export default ActivityPlay
