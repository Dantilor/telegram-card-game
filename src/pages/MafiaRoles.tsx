import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useMafiaGame } from '../games/mafia/MafiaGameContext'
import { ROLE_LABELS, type Role } from '../games/mafia/types'
import { IMAGES } from '../assets/images'
import { hapticSelection, hapticImpact } from '../utils/haptics'
import { trackEvent } from '../lib/analytics'
import { HOST_RULES } from '../games/mafia/hostScript'
import MafiaPageNav from '../components/MafiaPageNav'
import MafiaHostLine from '../components/MafiaHostLine'
import './MafiaRoles.css'

const ROLE_DISPLAY_MS = 8000
const HOLD_MS = 900
const PASS_FLIP_MS = 560
const PASS_OVERLAY_MS = 960

const ROLE_HINTS: Record<Role, string> = {
  mafia: 'Ночью выбираете жертву вместе с мафией. Днём притворяетесь мирным.',
  doctor: 'Ночью лечите одного игрока — он не умрёт от выстрела мафии.',
  sheriff: 'Ночью проверяете одного игрока: мафия или мирный. Результат видите только вы.',
  civilian: 'У вас нет ночных способностей. Днём ищите мафию и голосуйте.',
}

const ROLE_ICONS: Record<Role, string> = {
  civilian: '👤',
  mafia: '🌙',
  doctor: '💊',
  sheriff: '⭐',
}

function useHoldReveal(onComplete: () => void, holdMs: number) {
  const [progress, setProgress] = useState(0)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)

  const cancel = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    startRef.current = null
    setProgress(0)
  }, [])

  const start = useCallback(() => {
    hapticSelection()
    startRef.current = performance.now()
    const tick = (now: number) => {
      if (startRef.current == null) return
      const pct = Math.min(100, ((now - startRef.current) / holdMs) * 100)
      setProgress(pct)
      if (pct >= 100) {
        cancel()
        hapticImpact('heavy')
        onComplete()
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [holdMs, onComplete, cancel])

  useEffect(() => () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
  }, [])

  return { progress, start, cancel }
}

function MafiaRoles() {
  const navigate = useNavigate()
  const { state, dispatch } = useMafiaGame()
  const [roleRevealed, setRoleRevealed] = useState(false)
  const [roleDimmed, setRoleDimmed] = useState(false)
  const [passing, setPassing] = useState(false)
  const [passingOut, setPassingOut] = useState(false)
  const [startingRound, setStartingRound] = useState(false)
  const [startingRoundOut, setStartingRoundOut] = useState(false)
  const [swapAnim, setSwapAnim] = useState(false)
  const startingRoundRef = useRef(false)
  const [countdownPct, setCountdownPct] = useState(100)
  const isFirstPlayerRef = useRef(true)

  useEffect(() => {
    if (!state.players.length) {
      navigate('/mafia')
    }
  }, [state.players.length, navigate])

  const player = state.players[state.roleViewIndex]
  const isLast = state.roleViewIndex >= state.players.length - 1
  const playerIndex = state.roleViewIndex

  useEffect(() => {
    trackEvent('start_game', { gameId: 'mafia' })
  }, [])

  const location = useLocation()
  useEffect(() => {
    if (startingRoundRef.current) return
    if (state.phase === 'night_intro' && location.pathname !== '/mafia/night') {
      navigate('/mafia/night', { replace: true })
    }
  }, [state.phase, location.pathname, navigate])

  const finishUnlock = useCallback(() => {
    setRoleRevealed(true)
  }, [])

  const { progress: holdProgress, start: startHold, cancel: cancelHold } = useHoldReveal(finishUnlock, HOLD_MS)

  useEffect(() => {
    cancelHold()
    setCountdownPct(100)

    if (isFirstPlayerRef.current) {
      isFirstPlayerRef.current = false
      return
    }

    if (startingRoundRef.current) return

    setSwapAnim(true)
    const swapTimer = window.setTimeout(() => setSwapAnim(false), 480)
    return () => window.clearTimeout(swapTimer)
  }, [playerIndex, cancelHold])

  useEffect(() => {
    if (roleRevealed) {
      setRoleDimmed(false)
      const dimTimer = setTimeout(() => setRoleDimmed(true), ROLE_DISPLAY_MS)
      return () => clearTimeout(dimTimer)
    }
    setRoleDimmed(false)
    setCountdownPct(100)
  }, [roleRevealed, playerIndex])

  useEffect(() => {
    if (!roleRevealed || roleDimmed) return
    const start = Date.now()
    const iv = setInterval(() => {
      const remaining = Math.max(0, ROLE_DISPLAY_MS - (Date.now() - start))
      setCountdownPct((remaining / ROLE_DISPLAY_MS) * 100)
    }, 80)
    return () => clearInterval(iv)
  }, [roleRevealed, roleDimmed, playerIndex])

  const handleNext = () => {
    hapticSelection()

    if (isLast) {
      startingRoundRef.current = true
      setStartingRound(true)
      setStartingRoundOut(false)
      setRoleRevealed(false)
      setRoleDimmed(false)

      window.setTimeout(() => {
        dispatch({ type: 'NEXT_ROLE_VIEW' })
        setStartingRoundOut(true)
      }, PASS_FLIP_MS)

      window.setTimeout(() => {
        navigate('/mafia/night', { replace: true })
        setStartingRound(false)
        setStartingRoundOut(false)
        startingRoundRef.current = false
      }, PASS_OVERLAY_MS)
      return
    }

    setPassing(true)
    setPassingOut(false)
    setRoleRevealed(false)
    setRoleDimmed(false)

    window.setTimeout(() => {
      dispatch({ type: 'NEXT_ROLE_VIEW' })
      setPassingOut(true)
    }, PASS_FLIP_MS)

    window.setTimeout(() => {
      setPassing(false)
      setPassingOut(false)
    }, PASS_OVERLAY_MS)
  }

  if (!state.players.length) {
    return null
  }

  if (!player) {
    navigate('/mafia')
    return null
  }

  const roleLabel = ROLE_LABELS[player.role]
  const roleHint = ROLE_HINTS[player.role]
  const roleEmoji = ROLE_ICONS[player.role]
  const isDoctor = player.role === 'doctor'
  const isMafia = player.role === 'mafia'
  const isSheriff = player.role === 'sheriff'
  const isCivilian = player.role === 'civilian'
  const civilianImg = isCivilian
    ? (player.civilianImageIndex === 1 ? IMAGES.mafiaCivilian2.png : IMAGES.mafiaCivilian1.png)
    : null

  const progressPct = ((playerIndex + (roleRevealed ? 1 : 0)) / state.players.length) * 100

  return (
    <div className="mafia-page mafia-page--night mafia-roles">
      <MafiaPageNav />

      <MafiaHostLine hostName={state.hostName}>
        {HOST_RULES.roleDeal}
      </MafiaHostLine>

      <div className="mafia-roles__header">
        <p className="mafia-roles__step">Раздача ролей</p>
        <div className="mafia-roles__progress-track" aria-hidden>
          <div className="mafia-roles__progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="mafia-roles__players" role="list" aria-label="Игроки">
          {state.players.map((p, i) => (
            <span
              key={p.id}
              role="listitem"
              className={`mafia-roles__player-chip${i === playerIndex ? ' is-current' : ''}${i < playerIndex ? ' is-done' : ''}`}
              title={p.name}
            >
              {i < playerIndex ? '✓' : p.name.trim().charAt(0).toUpperCase() || (i + 1)}
            </span>
          ))}
        </div>
        <p className="mafia-roles__counter">
          Игрок {playerIndex + 1} из {state.players.length}
        </p>
      </div>

      <div
        className={`mafia-roles__card mafia-page__panel mafia-page__panel--glow-a mafia-roles__card--${player.role}${roleRevealed ? ' mafia-roles__card--revealed' : ''}${swapAnim ? ' mafia-roles__card--swap' : ''}`}
      >
        <div className="mafia-roles__card-shimmer" aria-hidden />

        <div className={`mafia-roles__flip ${roleRevealed ? 'mafia-roles__flip--flipped' : ''}`}>
          <div className="mafia-roles__flip-inner">
            <div className="mafia-roles__face mafia-roles__face--front">
              <p className="mafia-roles__player-name">{player.name}</p>
              <div className="mafia-roles__sealed">
                <span className="mafia-roles__sealed-icon" aria-hidden>🃏</span>
                <p className="mafia-roles__sealed-title">Секретная карта</p>
                <p className="mafia-roles__sealed-text">
                  Только для глаз {player.name.split(' ')[0] || 'игрока'}.
                  <br />
                  Удерживай кнопку, чтобы открыть роль.
                </p>
                <span className="mafia-roles__privacy">
                  <span aria-hidden>🔒</span> Никому не показывай
                </span>
              </div>

              <button
                type="button"
                className={`mafia-roles__hold-btn${holdProgress > 0 ? ' is-holding' : ''}`}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId)
                  startHold()
                }}
                onPointerUp={cancelHold}
                onPointerCancel={cancelHold}
                onPointerLeave={cancelHold}
                aria-label="Удерживай, чтобы показать роль"
              >
                <svg className="mafia-roles__hold-ring" viewBox="0 0 100 100" aria-hidden>
                  <circle className="mafia-roles__hold-ring-bg" cx="50" cy="50" r="44" />
                  <circle
                    className="mafia-roles__hold-ring-fill"
                    cx="50"
                    cy="50"
                    r="44"
                    style={{ strokeDashoffset: `${276.46 * (1 - holdProgress / 100)}` }}
                  />
                </svg>
                <span className="mafia-roles__hold-label">
                  {holdProgress > 0 ? 'Держи…' : 'Удерживай'}
                </span>
              </button>
            </div>

            <div className="mafia-roles__face mafia-roles__face--back">
              <div
                className={`mafia-roles__reveal ${roleDimmed ? 'mafia-roles__reveal--dimmed' : ''} ${
                  roleRevealed ? 'mafia-roles__reveal--glow' : ''
                }`}
              >
                <p className="mafia-roles__revealed-player">{player.name}</p>
                <span className="mafia-roles__role-badge">{roleEmoji} {roleLabel}</span>
                <p className="mafia-roles__role-hint">{roleHint}</p>

                <div className="mafia-roles__portrait">
                  {isDoctor ? (
                    <img src={IMAGES.mafiaDoctor.png} alt="" className="mafia-roles__role-img" decoding="async" loading="eager" />
                  ) : isMafia ? (
                    <img src={IMAGES.mafiaRole.png} alt="" className="mafia-roles__role-img" decoding="async" loading="eager" />
                  ) : isSheriff ? (
                    <img src={IMAGES.mafiaSheriff.png} alt="" className="mafia-roles__role-img" decoding="async" loading="eager" />
                  ) : civilianImg ? (
                    <img src={civilianImg} alt="" className="mafia-roles__role-img" decoding="async" loading="eager" />
                  ) : (
                    <span className="mafia-roles__emoji" aria-hidden>{roleEmoji}</span>
                  )}
                </div>

                {!roleDimmed && (
                  <div className="mafia-roles__countdown" aria-live="polite">
                    <div className="mafia-roles__countdown-track">
                      <div className="mafia-roles__countdown-fill" style={{ width: `${countdownPct}%` }} />
                    </div>
                    <span className="mafia-roles__countdown-label">Запомни роль — скоро скроем</span>
                  </div>
                )}

                {roleDimmed && (
                  <p className="mafia-roles__dimmed-hint">Роль скрыта. Можно передать телефон.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {roleRevealed && (
          <button
            type="button"
            className="mafia-page__cta mafia-roles__next-btn"
            onClick={handleNext}
          >
            {isLast ? 'Начать раунд' : 'Передать следующему →'}
          </button>
        )}
      </div>

      {passing && (
        <div className={`mafia-roles__pass-overlay${passingOut ? ' is-leaving' : ''}`} aria-live="polite">
          <div className="mafia-roles__pass-card">
            <span className="mafia-roles__pass-icon" aria-hidden>📱</span>
            <p className="mafia-roles__pass-title">Передай телефон</p>
            <p className="mafia-roles__pass-text">
              Следующий: {state.players[playerIndex + 1]?.name ?? 'игрок'}
            </p>
          </div>
        </div>
      )}

      {startingRound && (
        <div className={`mafia-roles__pass-overlay mafia-roles__pass-overlay--round${startingRoundOut ? ' is-leaving' : ''}`} aria-live="polite">
          <div className="mafia-roles__pass-card">
            <span className="mafia-roles__pass-icon" aria-hidden>🌙</span>
            <p className="mafia-roles__pass-title">Город засыпает</p>
            <p className="mafia-roles__pass-text">Начинаем первую ночь…</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default MafiaRoles
