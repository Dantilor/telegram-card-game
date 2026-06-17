import { useEffect, useState, useRef, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAliasStateContext } from '../games/alias/AliasStateContext'
import { saveAliasState, getInitialAliasState } from '../games/alias/state'
import { getCurrentTeam, getCurrentTeamSlotIndex } from '../games/alias/types'
import { haptic } from '../utils/telegram'
import { hapticSelection, hapticSuccess } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
import GameExitConfirmModal from '../components/GameExitConfirmModal'
import './AliasPlay.css'

const TICK_MS = 250
const REDIRECT_STUCK_MS = 4000

function AliasPlayTopNav({
  onBack,
  onBeforeHomeNavigate,
}: {
  onBack: () => void
  onBeforeHomeNavigate?: () => boolean
}) {
  return (
    <div className="alias-page__top">
      <HomeButton className="alias-page__nav-btn" onBeforeNavigate={onBeforeHomeNavigate} />
      <BackButton onClick={onBack} className="alias-page__nav-btn alias-page__back" />
    </div>
  )
}

/** Redirect to /alias when phase is setup; avoid navigate() during render (mobile WebView fix). */
function AliasRedirectToHome({ onNavigate, onGoHome }: { onNavigate: () => void; onGoHome?: () => void }) {
  const [stuck, setStuck] = useState(false)
  const didRedirect = useRef(false)
  const navigate = useNavigate()
  const goHome = onGoHome ?? (() => navigate('/'))

  useEffect(() => {
    if (didRedirect.current) return
    didRedirect.current = true
    onNavigate()
  }, [onNavigate])

  useEffect(() => {
    const t = setTimeout(() => {
      if (typeof window !== 'undefined' && import.meta.env?.DEV) {
        const tg = (window as unknown as { Telegram?: { WebApp?: unknown } }).Telegram?.WebApp
        console.info('[Alias] Redirect stuck diagnostic', {
          isTelegramAvailable: Boolean(tg),
          route: window.location.hash,
          userAgent: navigator.userAgent?.slice(0, 60),
          viewportHeight: window.innerHeight,
        })
      }
      setStuck(true)
    }, REDIRECT_STUCK_MS)
    return () => clearTimeout(t)
  }, [])

  if (stuck) {
    return (
      <div className="alias-page alias-play alias-play--stuck">
        <p className="alias-play__message">Переход не удался</p>
        <p className="alias-play__stuck-hint">Нажмите кнопку ниже</p>
        <div className="alias-play__stuck-actions">
          <button
            type="button"
            className="alias-page__cta"
            onClick={() => {
              haptic('light')
              onNavigate()
            }}
          >
            К настройкам игры
          </button>
          <button
            type="button"
            className="alias-page__btn alias-page__btn--secondary"
            onClick={() => {
              haptic('light')
              goHome()
            }}
          >
            На главную
          </button>
        </div>
      </div>
    )
  }

  return null
}

function AliasPlay() {
  const navigate = useNavigate()
  const { state, dispatch } = useAliasStateContext()
  const [showExitConfirm, setShowExitConfirm] = useState<'home' | 'back' | null>(null)

  const onBeforeHomeNavigate = () => {
    setShowExitConfirm('home')
    return true
  }

  const onBack = () => {
    setShowExitConfirm('back')
  }

  const handleExitConfirm = (confirmed: boolean) => {
    setShowExitConfirm(null)
    if (!confirmed) return
    haptic('light')
    const initialState = getInitialAliasState()
    saveAliasState(initialState)
    dispatch({ type: 'RESET_ALL' })
    navigate('/games')
  }

  let phaseContent: ReactNode = null

  if (state.phase === 'turn_ready') {
    phaseContent = (
      <TeamTurnReadyScreen state={state} dispatch={dispatch} />
    )
  } else if (state.phase === 'in_round') {
    phaseContent = (
      <TeamInRoundScreen state={state} dispatch={dispatch} />
    )
  } else if (state.phase === 'round_results' && state.currentTeamIndex === state.activeTeamSlots.length - 1) {
    phaseContent = (
      <FullRoundSummaryScreen state={state} dispatch={dispatch} onBack={onBack} />
    )
  } else if (state.phase === 'round_results') {
    phaseContent = (
      <TeamRoundResultsScreen state={state} dispatch={dispatch} />
    )
  } else if (state.phase !== 'setup') {
    phaseContent = <AliasRedirectToHome onNavigate={() => navigate('/alias', { replace: true })} />
  }

  if (state.phase === 'setup') {
    return <AliasRedirectToHome onNavigate={() => navigate('/alias', { replace: true })} />
  }

  return (
    <div className="alias-page alias-play alias-play--session">
      <AliasPlayTopNav onBack={onBack} onBeforeHomeNavigate={onBeforeHomeNavigate} />
      <div key={state.phase} className="alias-play__phase alias-play__phase--enter">
        {phaseContent}
      </div>
      {showExitConfirm != null && (
        <GameExitConfirmModal
          hint="Если выйти, весь прогресс будет сброшен (команды, счёт, раунд, выбранные настройки)."
          onCancel={() => handleExitConfirm(false)}
          onConfirm={() => handleExitConfirm(true)}
        />
      )}
    </div>
  )
}

function TeamTurnReadyScreen({
  state,
  dispatch,
}: {
  state: import('../games/alias/types').AliasState
  dispatch: (a: import('../games/alias/reducer').AliasAction) => void
}) {
  const team = getCurrentTeam(state)
  const hostName =
    team && team.players.length > 0
      ? team.players[team.activePlayerIndex % team.players.length] ?? team.players[0]
      : '—'

  return (
    <>
      <header className="alias-play__turn-ready">
        <h1 className="alias-play__turn-title">Ход: {team?.name.trim() || '—'}</h1>
        <p className="alias-play__turn-host">Ведущий: {hostName}</p>
      </header>
      <div className="alias-play__turn-card alias-page__panel alias-page__panel--glow-a">
        <span className="alias-play__turn-badge">Готовы?</span>
        <p className="alias-page__hint">Объясняй слова без однокоренных. Таймер стартует после нажатия.</p>
      </div>
      <div className="alias-play__turn-actions">
        <button
          type="button"
          className="alias-page__btn alias-page__btn--secondary"
          onClick={() => {
            hapticSelection()
            dispatch({ type: 'NEXT_HOST' })
          }}
        >
          Другой ведущий
        </button>
        <button
          type="button"
          className="alias-page__cta"
          onClick={() => {
            haptic('medium')
            dispatch({ type: 'START_ROUND' })
          }}
        >
          Начать раунд
        </button>
      </div>
    </>
  )
}

function TeamInRoundScreen({
  state,
  dispatch,
}: {
  state: import('../games/alias/types').AliasState
  dispatch: (a: import('../games/alias/reducer').AliasAction) => void
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
    return <p className="alias-play__message">Загрузка…</p>
  }

  return (
    <>
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
      <div className="alias-play__word-card alias-page__panel alias-page__panel--glow-b" key={currentWord}>
        <p className="alias-play__word">{currentWord}</p>
      </div>
      <div className="alias-play__actions">
        <button
          type="button"
          className="alias-page__cta"
          onClick={() => {
            hapticSuccess()
            dispatch({ type: 'GUESSED' })
          }}
        >
          ✅ Угадали
        </button>
        <button
          type="button"
          className="alias-page__btn alias-page__btn--secondary"
          onClick={() => {
            haptic('light')
            dispatch({ type: 'SKIPPED' })
          }}
        >
          ⏭️ Пропуск
        </button>
      </div>
    </>
  )
}

/** Итоги целого раунда (все команды сделали по ходу): счёт всех команд, «Начать раунд заново» / «Выйти». */
function FullRoundSummaryScreen({
  state,
  dispatch,
  onBack,
}: {
  state: import('../games/alias/types').AliasState
  dispatch: (a: import('../games/alias/reducer').AliasAction) => void
  onBack: () => void
}) {
  const activeSlots = state.activeTeamSlots
  const teamsWithScores = activeSlots.map((slotIdx) => ({
    name: state.teams[slotIdx]?.name.trim() || `Команда ${slotIdx + 1}`,
    score: state.teamScores[slotIdx] ?? 0,
  }))

  return (
    <div className="alias-play--results alias-play--full-round">
      <header className="alias-play__results-header">
        <h1 className="alias-play__results-title">Итоги раунда</h1>
      </header>
      <div className="alias-play__full-round-scores">
        {teamsWithScores.map(({ name, score }, i) => (
          <div key={i} className="alias-play__full-round-score-row alias-page__panel alias-page__panel--glow-a">
            <span className="alias-play__full-round-team-name">{name}</span>
            <span className="alias-play__full-round-team-value">{score}</span>
          </div>
        ))}
      </div>
      <div className="alias-play__full-round-actions">
        <button
          type="button"
          className="alias-page__cta"
          onClick={() => {
            hapticSelection()
            dispatch({ type: 'PASS_TURN' })
          }}
        >
          Начать раунд заново
        </button>
        <button
          type="button"
          className="alias-page__btn alias-page__btn--secondary"
          onClick={onBack}
        >
          Выйти
        </button>
      </div>
    </div>
  )
}

function TeamRoundResultsScreen({
  state,
  dispatch,
}: {
  state: import('../games/alias/types').AliasState
  dispatch: (a: import('../games/alias/reducer').AliasAction) => void
}) {
  const team = getCurrentTeam(state)
  const score = team ? (state.teamScores[getCurrentTeamSlotIndex(state)] ?? 0) : 0

  return (
    <div className="alias-play--results">
      <header className="alias-play__results-header">
        <h1 className="alias-play__results-title">Итоги раунда</h1>
      </header>
      <div className="alias-play__results-stats alias-page__panel alias-page__panel--glow-a">
        <div className="alias-play__results-stat">
          <span className="alias-play__results-value">{state.guessed}</span>
          <span className="alias-play__results-label">Угадано</span>
        </div>
        <div className="alias-play__results-stat">
          <span className="alias-play__results-value">{state.skipped}</span>
          <span className="alias-play__results-label">Пропущено</span>
        </div>
      </div>
      <div className="alias-play__results-score alias-page__panel alias-page__panel--glow-b">
        Очки команды «{team?.name.trim() ?? '—'}»: {score}
      </div>
      <div className="alias-play__results-actions">
        <button
          type="button"
          className="alias-page__cta"
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

export default AliasPlay
