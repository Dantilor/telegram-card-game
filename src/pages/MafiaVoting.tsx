import { useEffect, useLayoutEffect, useRef } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import { useMafiaGame } from '../games/mafia/MafiaGameContext'
import { useBack } from '../hooks/useBack'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import './MafiaVoting.css'

function MafiaVoting() {
  const navigate = useNavigate()
  const location = useLocation()
  const { state, dispatch } = useMafiaGame()
  const handleBack = useBack('/mafia/day')
  const navigatedRef = useRef(false)

  const aliveCount = state.players.filter((p) => p.alive).length

  // Редирект до отрисовки после голосования (один раз на переход)
  useLayoutEffect(() => {
    if (state.winner && location.pathname !== '/mafia/result') {
      navigatedRef.current = true
      navigate('/mafia/result')
      return
    }
    if (state.phase === 'night_intro' && location.pathname !== '/mafia/night') {
      navigatedRef.current = true
      navigate('/mafia/night')
    }
  }, [state.phase, state.winner, location.pathname, navigate])

  // Резервный редирект через 50 ms, если useLayoutEffect не сработал (например в части окружений)
  useEffect(() => {
    if (state.phase !== 'night_intro' && state.phase !== 'result') return
    if (location.pathname !== '/mafia/voting') return
    const t = setTimeout(() => {
      if (state.winner) navigate('/mafia/result')
      else navigate('/mafia/night')
    }, 50)
    return () => clearTimeout(t)
  }, [state.phase, state.winner, location.pathname, navigate])

  useEffect(() => {
    if (!state.players.length && location.pathname.startsWith('/mafia')) {
      navigate('/mafia')
    }
  }, [state.players.length, location.pathname, navigate])

  // Редирект при невалидном состоянии (никого не осталось) — хук ВСЕГДА вызывается (правило хуков)
  useEffect(() => {
    if (state.phase !== 'voting_collect') return
    if (aliveCount > 1) return
    if (location.pathname !== '/mafia/night') navigate('/mafia/night')
  }, [state.phase, aliveCount, location.pathname, navigate])

  if (!state.players.length) {
    return (
      <div className="mafia-voting">
        <div className="mafia-voting__top">
          <HomeButton />
          <button type="button" className="btn btn--ghost mafia-voting__back" onClick={() => navigate('/mafia')}>
            ← В меню
          </button>
        </div>
        <p className="mafia-voting__subtitle" style={{ padding: '1rem', textAlign: 'center' }}>
          Нет игроков. Вернитесь в настройки.
        </p>
      </div>
    )
  }

  // Сразу показываем итог голосования (кто исключён / ничья) — чтобы экран не зависал
  if (state.phase === 'voting_summary') {
    const targetPlayer = state.votingSummaryTargetId
      ? state.players.find((p) => p.id === state.votingSummaryTargetId)
      : null
    return (
      <div className="mafia-voting">
        <div className="mafia-voting__top">
          <HomeButton />
          <button type="button" className="btn btn--ghost mafia-voting__back" onClick={handleBack}>
            ← В меню
          </button>
        </div>
        <div className="mafia-voting__summary card">
          <h2 className="mafia-voting__summary-title">Решение принято.</h2>
          <p className="mafia-voting__summary-text">
            {targetPlayer ? `Большинство выбрало: ${targetPlayer.name}` : 'Ничья. Никого не исключили.'}
          </p>
          <p className="mafia-voting__summary-hint">Толпа не ошибается… или ошибается?</p>
          <button
            type="button"
            className="btn btn--primary mafia-voting__summary-btn"
            onClick={() => {
              hapticSelection()
              flushSync(() => dispatch({ type: 'CONFIRM_VOTING' }))
              // Навигация по state.phase / state.winner в useLayoutEffect — так всегда показываем результат при победе
            }}
          >
            Продолжить
          </button>
        </div>
      </div>
    )
  }

  const alive = state.players.filter((p) => p.alive)
  const currentVoter = alive[state.voteCollectIndex]
  const targets = alive.filter((p) => p.id !== currentVoter?.id)

  // Уже переход на ночь или результат — редирект в useLayoutEffect; пока не ушли — заглушка
  if (state.phase === 'night_intro' || state.phase === 'result') {
    return (
      <div className="mafia-voting">
        <div className="mafia-voting__top">
          <HomeButton />
          <button type="button" className="btn btn--ghost mafia-voting__back" onClick={handleBack}>
            ← В меню
          </button>
        </div>
        <p className="mafia-voting__subtitle" style={{ padding: '1rem', textAlign: 'center' }}>
          Переход…
        </p>
      </div>
    )
  }

  // Фаза не для страницы голосования — показываем fallback вместо пустого экрана
  const phase = state.phase
  const allowedVotingPhases = ['voting_collect', 'voting_summary', 'night_intro', 'result']
  if (!allowedVotingPhases.includes(phase)) {
    return (
      <div className="mafia-voting">
        <div className="mafia-voting__top">
          <HomeButton />
          <button type="button" className="btn btn--ghost mafia-voting__back" onClick={handleBack}>
            ← В меню
          </button>
        </div>
        <div className="mafia-voting__summary card">
          <h2 className="mafia-voting__summary-title">Неверная страница</h2>
          <p className="mafia-voting__summary-text">
            Текущая фаза: {phase}. Ожидалась страница голосования или переход.
          </p>
          <button
            type="button"
            className="btn btn--primary mafia-voting__summary-btn"
            onClick={() => (phase === 'day' ? navigate('/mafia/day') : navigate('/mafia/night'))}
          >
            {phase === 'day' ? 'К дню' : 'К ночи'}
          </button>
        </div>
      </div>
    )
  }

  const handleVote = (targetId: string) => {
    if (!currentVoter) return
    hapticSelection()
    dispatch({ type: 'SUBMIT_VOTE', voterId: currentVoter.id, targetId })
  }

  // После итогов голосования фаза уже night_intro или result — редирект делается в useLayoutEffect выше.
  // Если всё же остались на странице (редкий кейс), показываем заглушку вместо пустого экрана.
  if (!currentVoter || alive.length <= 1) {
    return (
      <div className="mafia-voting">
        <div className="mafia-voting__top">
          <HomeButton />
          <button type="button" className="btn btn--ghost mafia-voting__back" onClick={handleBack}>
            ← В меню
          </button>
        </div>
        <p className="mafia-voting__subtitle" style={{ padding: '1rem', textAlign: 'center' }}>
          Переход…
        </p>
      </div>
    )
  }

  if (targets.length === 0) {
    return (
      <div className="mafia-voting">
        <div className="mafia-voting__top">
          <HomeButton />
          <button type="button" className="btn btn--ghost mafia-voting__back" onClick={handleBack}>
            ← В меню
          </button>
        </div>
        <p className="mafia-voting__subtitle" style={{ padding: '1rem', textAlign: 'center' }}>
          Не за кого голосовать.
        </p>
      </div>
    )
  }

  // Защита от чёрного экрана: если фаза не voting_collect — показываем fallback вместо пустого экрана
  if (state.phase !== 'voting_collect') {
    return (
      <div className="mafia-voting">
        <div className="mafia-voting__top">
          <HomeButton />
          <button type="button" className="btn btn--ghost mafia-voting__back" onClick={handleBack}>
            ← В меню
          </button>
        </div>
        <div className="mafia-voting__summary card">
          <h2 className="mafia-voting__summary-title">Неизвестная фаза</h2>
          <p className="mafia-voting__summary-text">
            Фаза: {state.phase}. Нажмите «Запустить заново», чтобы вернуться в меню.
          </p>
          <button
            type="button"
            className="btn btn--primary mafia-voting__summary-btn"
            onClick={() => navigate('/mafia')}
          >
            Запустить заново
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mafia-voting">
      <div className="mafia-voting__top">
        <HomeButton />
        <button type="button" className="btn btn--ghost mafia-voting__back" onClick={handleBack}>
          ← В меню
        </button>
      </div>

      <h2 className="mafia-voting__title">Город требует крови.</h2>
      <p className="mafia-voting__subtitle">Кто выглядит подозрительно?</p>
      <p className="mafia-voting__voter">
        {currentVoter.name}, кого исключить?
      </p>

      <div className="mafia-voting__targets">
        {targets.map((p) => (
          <button
            key={p.id}
            type="button"
            className="btn card mafia-voting__target"
            onClick={() => handleVote(p.id)}
          >
            {p.name}
          </button>
        ))}
      </div>

      <p className="mafia-voting__hint">
        {state.voteCollectIndex + 1} / {alive.length}
      </p>
    </div>
  )
}

export default MafiaVoting
