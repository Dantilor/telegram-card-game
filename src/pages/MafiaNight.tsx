import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useMafiaGame } from '../games/mafia/MafiaGameContext'
import { hapticSelection } from '../utils/haptics'
import MafiaPageNav from '../components/MafiaPageNav'
import MafiaHostLine from '../components/MafiaHostLine'
import { HOST_RULES } from '../games/mafia/hostScript'
import { MafiaNightStepLayout } from '../components/mafia/MafiaNightStepLayout'
import './MafiaNight.css'

function MafiaNight() {
  const navigate = useNavigate()
  const location = useLocation()
  const { state, dispatch } = useMafiaGame()
  const [showConfirm, setShowConfirm] = useState(false)

  // Один переход на одно изменение фазы: навигация только если мы ещё не на целевом path (защита от StrictMode и двойного вызова)
  useEffect(() => {
    if (state.winner && location.pathname !== '/mafia/result') {
      navigate('/mafia/result')
      return
    }
    if (state.phase === 'day' && location.pathname !== '/mafia/day') {
      navigate('/mafia/day')
    }
  }, [state.phase, state.winner, location.pathname, navigate])

  useEffect(() => {
    if (!state.players.length) navigate('/mafia')
  }, [state.players.length, navigate])

  if (!state.players.length) {
    return null
  }

  const alive = state.players.filter((p) => p.alive)
  const mafia = alive.filter((p) => p.role === 'mafia')
  const doctor = alive.find((p) => p.role === 'doctor' && p.alive)
  const sheriff = alive.find((p) => p.role === 'sheriff' && p.alive)

  const nightSteps = [mafia.length > 0 && 'mafia', doctor && 'doctor', sheriff && 'sheriff'].filter(Boolean) as string[]

  const goToNextNightStep = () => {
    setShowConfirm(false)
    if (state.phase === 'night_mafia') {
      if (doctor) dispatch({ type: 'SET_PHASE', phase: 'night_doctor_intro' })
      else if (sheriff) dispatch({ type: 'SET_PHASE', phase: 'night_sheriff_intro' })
      else dispatch({ type: 'APPLY_NIGHT' })
    } else if (state.phase === 'night_doctor') {
      if (sheriff) dispatch({ type: 'SET_PHASE', phase: 'night_sheriff_intro' })
      else dispatch({ type: 'APPLY_NIGHT' })
    } else if (state.phase === 'night_sheriff') {
      dispatch({ type: 'APPLY_NIGHT' })
    }
  }

  // night_intro — "Ночь. Все закрывают глаза" + кнопка Начать
  if (state.phase === 'night_intro') {
    return (
      <div className="mafia-page mafia-page--night mafia-night mafia-night--intro-enter">
        <MafiaPageNav />
        <MafiaHostLine hostName={state.hostName}>
          «Город засыпает». Все закрывают глаза. Начинается ночная фаза.
        </MafiaHostLine>
        <MafiaNightStepLayout
          stepTitle={`Ночь ${state.roundNumber}`}
          roleTitle="Ночь"
          description={HOST_RULES.nightOrder}
          primaryButtonLabel="Начать ночь"
          primaryButtonOnClick={() => {
            hapticSelection()
            if (mafia.length > 0) {
              dispatch({ type: 'SET_PHASE', phase: 'night_mafia_intro' })
            } else if (doctor) {
              dispatch({ type: 'SET_PHASE', phase: 'night_doctor_intro' })
            } else if (sheriff) {
              dispatch({ type: 'SET_PHASE', phase: 'night_sheriff_intro' })
            } else {
              dispatch({ type: 'APPLY_NIGHT' })
            }
          }}
        />
      </div>
    )
  }

  // night_mafia_intro — перехват перед выбором мафии
  if (state.phase === 'night_mafia_intro' && mafia.length > 0) {
    return (
      <div className="mafia-page mafia-page--night mafia-night">
        <MafiaPageNav />
        <MafiaHostLine hostName={state.hostName}>
          «Мафия, просыпайтесь!» Выберите жертву. Доктор и шериф ходят после вас.
        </MafiaHostLine>
        <MafiaNightStepLayout
          stepTitle={`Ночь — шаг 1 / ${nightSteps.length}`}
          roleTitle="Ход: Мафия"
          description="Мафия выбирает жертву. Ведущий фиксирует выбор."
          primaryButtonLabel="Начать"
          primaryButtonOnClick={() => {
            hapticSelection()
            dispatch({ type: 'SET_PHASE', phase: 'night_mafia' })
          }}
        />
      </div>
    )
  }

  // night_mafia — выбор жертвы
  if (state.phase === 'night_mafia' && mafia.length > 0) {
    const targets = alive.filter((p) => p.role !== 'mafia')
    const hasSelection = state.nightAction.mafiaTarget != null
    const mafiaTargetPlayer = hasSelection ? alive.find((p) => p.id === state.nightAction.mafiaTarget) : null

    if (showConfirm && hasSelection) {
      return (
        <div className="mafia-page mafia-page--night mafia-night">
          <MafiaPageNav />
          <MafiaNightStepLayout
            stepTitle={`Ночь — шаг 1 / ${nightSteps.length}`}
            statusBlock={
              <>
                <span className="mafia-night-step__status-badge">Выбор сохранён</span>
                {mafiaTargetPlayer && (
                  <span className="mafia-night-step__status-pill">Игрок: {mafiaTargetPlayer.name}</span>
                )}
              </>
            }
            primaryButtonLabel="Продолжить"
            primaryButtonOnClick={() => {
              hapticSelection()
              goToNextNightStep()
            }}
          />
        </div>
      )
    }

    return (
      <div className="mafia-page mafia-page--night mafia-night">
        <MafiaPageNav />
        <MafiaNightStepLayout
          stepTitle={`Ночь — шаг 1 / ${nightSteps.length}`}
          roleTitle="Мафия, выберите жертву"
          primaryButtonLabel="Продолжить"
          primaryButtonOnClick={() => {
            hapticSelection()
            if (hasSelection) setShowConfirm(true)
          }}
          primaryButtonDisabled={!hasSelection}
        >
          {targets.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`mafia-page__target ${state.nightAction.mafiaTarget === p.id ? 'is-selected' : ''}`}
              onClick={() => {
                hapticSelection()
                dispatch({ type: 'SET_NIGHT_MAFIA', target: p.id })
              }}
            >
              {p.name}
            </button>
          ))}
        </MafiaNightStepLayout>
      </div>
    )
  }

  // night_doctor_intro
  if (state.phase === 'night_doctor_intro' && doctor) {
    return (
      <div className="mafia-page mafia-page--night mafia-night">
        <MafiaPageNav />
        <MafiaNightStepLayout
          stepTitle={`Ночь — шаг 2 / ${nightSteps.length}`}
          roleTitle="Ход: Доктор"
          description="Жизнь висит на волоске. Кого вы спасёте этой ночью?"
          primaryButtonLabel="Начать"
          primaryButtonOnClick={() => {
            hapticSelection()
            dispatch({ type: 'SET_PHASE', phase: 'night_doctor' })
          }}
        />
      </div>
    )
  }

  // night_doctor — выбор кого лечить
  if (state.phase === 'night_doctor' && doctor) {
    const hasSelection = state.nightAction.doctorTarget != null
    const doctorTargetPlayer = hasSelection ? alive.find((p) => p.id === state.nightAction.doctorTarget) : null

    if (showConfirm && hasSelection) {
      return (
        <div className="mafia-page mafia-page--night mafia-night">
          <MafiaPageNav />
          <MafiaNightStepLayout
            stepTitle={`Ночь — шаг 2 / ${nightSteps.length}`}
            statusBlock={
              <>
                <span className="mafia-night-step__status-badge">Выбор сохранён</span>
                {doctorTargetPlayer && (
                  <span className="mafia-night-step__status-pill">Игрок: {doctorTargetPlayer.name}</span>
                )}
              </>
            }
            primaryButtonLabel="Продолжить"
            primaryButtonOnClick={() => {
              hapticSelection()
              goToNextNightStep()
            }}
          />
        </div>
      )
    }

    return (
      <div className="mafia-page mafia-page--night mafia-night">
        <MafiaPageNav />
        <MafiaNightStepLayout
          stepTitle={`Ночь — шаг 2 / ${nightSteps.length}`}
          roleTitle="Доктор, кого лечить?"
          primaryButtonLabel="Продолжить"
          primaryButtonOnClick={() => {
            hapticSelection()
            if (hasSelection) setShowConfirm(true)
          }}
          primaryButtonDisabled={!hasSelection}
        >
          {alive.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`mafia-page__target ${state.nightAction.doctorTarget === p.id ? 'is-selected' : ''}`}
              onClick={() => {
                hapticSelection()
                dispatch({ type: 'SET_NIGHT_DOCTOR', target: p.id })
              }}
            >
              {p.name}
            </button>
          ))}
        </MafiaNightStepLayout>
      </div>
    )
  }

  // night_sheriff_intro
  if (state.phase === 'night_sheriff_intro' && sheriff) {
    return (
      <div className="mafia-page mafia-page--night mafia-night">
        <MafiaPageNav />
        <MafiaNightStepLayout
          stepTitle={`Ночь — шаг 3 / ${nightSteps.length}`}
          roleTitle="Ход: Шериф"
          description="Закон не спит. Проверьте, кто скрывает правду."
          primaryButtonLabel="Начать"
          primaryButtonOnClick={() => {
            hapticSelection()
            dispatch({ type: 'SET_PHASE', phase: 'night_sheriff' })
          }}
        />
      </div>
    )
  }

  // night_sheriff — выбор кого проверить (результат показывается только после подтверждения)
  if (state.phase === 'night_sheriff' && sheriff) {
    const sheriffTarget = state.nightAction.sheriffTarget
    const sheriffResult = state.nightAction.sheriffResult
    const targets = alive.filter((p) => p.role !== 'sheriff')
    const hasSelection = sheriffTarget != null
    const checkedPlayer = sheriffTarget ? alive.find((p) => p.id === sheriffTarget) : null

    if (showConfirm && hasSelection) {
      return (
        <div className="mafia-page mafia-page--night mafia-night">
          <MafiaPageNav />
          <MafiaNightStepLayout
            stepTitle={`Ночь — шаг 3 / ${nightSteps.length}`}
            statusBlock={
              <>
                <span className="mafia-night-step__status-badge">Выбор сохранён</span>
                {checkedPlayer && sheriffResult !== null && (
                  <span className="mafia-night-step__status-pill">
                    {checkedPlayer.name}: {sheriffResult ? '🔴 Мафия' : '🟢 Мирный'}
                  </span>
                )}
              </>
            }
            primaryButtonLabel="Продолжить"
            primaryButtonOnClick={() => {
              hapticSelection()
              goToNextNightStep()
            }}
          />
        </div>
      )
    }

    return (
      <div className="mafia-page mafia-page--night mafia-night">
        <MafiaPageNav />
        <MafiaNightStepLayout
          stepTitle={`Ночь — шаг 3 / ${nightSteps.length}`}
          roleTitle="Шериф, кого проверить?"
          primaryButtonLabel="Подтвердить"
          primaryButtonOnClick={() => {
            hapticSelection()
            if (hasSelection) setShowConfirm(true)
          }}
          primaryButtonDisabled={!hasSelection}
        >
          {targets.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`mafia-page__target ${sheriffTarget === p.id ? 'is-selected' : ''}`}
              disabled={hasSelection}
              onClick={() => {
                if (hasSelection) return
                hapticSelection()
                dispatch({
                  type: 'SET_NIGHT_SHERIFF',
                  target: p.id,
                  result: p.role === 'mafia',
                })
              }}
            >
              {p.name}
            </button>
          ))}
        </MafiaNightStepLayout>
      </div>
    )
  }

  // Fallback: фаза не соответствует ночным шагам (например day, voting_summary) — не пустой экран
  const phase = state.phase
  const isDayOrVoting =
    phase === 'day' ||
    phase === 'voting_collect' ||
    phase === 'voting_summary' ||
    phase === 'round_summary' ||
    phase === 'result'
  return (
    <div className="mafia-page mafia-page--night mafia-night">
      <MafiaPageNav />
      <MafiaNightStepLayout
        stepTitle=""
        roleTitle="Переход"
        description={
          isDayOrVoting
            ? 'Сейчас должно открыться следующее окно. Если экран пустой — нажмите ниже.'
            : `Неизвестная фаза: ${phase}`
        }
        primaryButtonLabel={phase === 'result' || state.winner ? 'К результату игры' : 'Продолжить'}
        primaryButtonOnClick={() => {
          hapticSelection()
          if (phase === 'result' || state.winner) navigate('/mafia/result')
          else if (phase === 'day') navigate('/mafia/day')
          else if (phase === 'voting_collect' || phase === 'voting_summary' || phase === 'round_summary') navigate('/mafia/voting')
          else navigate('/mafia/night')
        }}
      />
    </div>
  )
}

export default MafiaNight
