import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAliasState } from '../games/alias/useAliasState'
import { getCurrentTeam, getCurrentTeamSlotIndex } from '../games/alias/types'
import { haptic } from '../utils/telegram'
import { hapticSelection, hapticSuccess } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import './AliasPlay.css'

const TICK_MS = 250
const REDIRECT_STUCK_MS = 4000

/** Redirect to /alias when phase is setup; avoid navigate() during render (mobile WebView fix). */
function AliasRedirectToHome({ onNavigate }: { onNavigate: () => void }) {
  const [stuck, setStuck] = useState(false)
  const didRedirect = useRef(false)

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
      <div className="alias-play alias-play--stuck">
        <p className="alias-play__message">Переход не удался</p>
        <p className="alias-play__stuck-hint">Нажмите кнопку ниже</p>
        <div className="alias-play__stuck-actions">
          <button
            type="button"
            className="btn btn--primary alias-play__stuck-btn"
            onClick={() => {
              haptic('light')
              onNavigate()
            }}
          >
            К настройкам игры
          </button>
          <button
            type="button"
            className="btn btn--ghost alias-play__stuck-btn"
            onClick={() => {
              haptic('light')
              window.location.hash = '#/'
            }}
          >
            На главную
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="alias-play">
      <p className="alias-play__message">Переход…</p>
    </div>
  )
}

function AliasPlay() {
  const navigate = useNavigate()
  const [state, , dispatch] = useAliasState()

  if (state.phase === 'setup') {
    return <AliasRedirectToHome onNavigate={() => navigate('/alias', { replace: true })} />
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

  return <AliasRedirectToHome onNavigate={() => navigate('/alias', { replace: true })} />
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

export default AliasPlay
