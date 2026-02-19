import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMafiaGame } from '../games/mafia/MafiaGameContext'
import { useBack } from '../hooks/useBack'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import './MafiaNight.css'

function MafiaNight() {
  const navigate = useNavigate()
  const { state, dispatch } = useMafiaGame()
  const [showConfirm, setShowConfirm] = useState(false)
  const handleBack = useBack('/mafia/roles')

  useEffect(() => {
    if (state.winner) {
      navigate('/mafia/result')
      return
    }
    if (state.phase === 'day') {
      navigate('/mafia/day')
    }
  }, [state.phase, state.winner, navigate])

  if (!state.players.length) {
    navigate('/mafia')
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
      <div className="mafia-night">
        <div className="mafia-night__top">
          <HomeButton />
          <button type="button" className="btn btn--ghost mafia-night__back" onClick={handleBack}>
            ← В меню
          </button>
        </div>
        <div className="mafia-night__intro card">
          <h2 className="mafia-night__intro-title">Ночь</h2>
          <p className="mafia-night__intro-text">Город засыпает. Никто не видит, кто сделает ход.</p>
          <button
            type="button"
            className="btn btn--primary mafia-night__intro-btn"
            onClick={() => {
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
          >
            Начать
          </button>
        </div>
      </div>
    )
  }

  // night_mafia_intro — перехват перед выбором мафии
  if (state.phase === 'night_mafia_intro' && mafia.length > 0) {
    return (
      <div className="mafia-night">
        <div className="mafia-night__top">
          <HomeButton />
          <button type="button" className="btn btn--ghost mafia-night__back" onClick={handleBack}>
            ← В меню
          </button>
        </div>
        <p className="mafia-night__progress">Ночь — шаг 1 / {nightSteps.length}</p>
        <div className="mafia-night__intercept card">
          <h2 className="mafia-night__intercept-title">Ход: Мафия</h2>
          <p className="mafia-night__intercept-phrase">Тьма сгущается.</p>
          <p className="mafia-night__intercept-instruction">Выберите жертву среди мирных жителей, того, кто не доживёт до утра.</p>
          <button
            type="button"
            className="btn btn--primary mafia-night__intercept-btn"
            onClick={() => {
              hapticSelection()
              dispatch({ type: 'SET_PHASE', phase: 'night_mafia' })
            }}
          >
            Начать
          </button>
        </div>
      </div>
    )
  }

  // night_mafia — выбор жертвы
  if (state.phase === 'night_mafia' && mafia.length > 0) {
    const targets = alive.filter((p) => p.role !== 'mafia')
    const hasSelection = state.nightAction.mafiaTarget != null

    if (showConfirm && hasSelection) {
      return (
        <div className="mafia-night">
          <div className="mafia-night__top">
            <HomeButton />
            <button type="button" className="btn btn--ghost mafia-night__back" onClick={handleBack}>
              ← В меню
            </button>
          </div>
          <p className="mafia-night__progress">Ночь — шаг 1 / {nightSteps.length}</p>
          <div className="mafia-night__confirm card">
            <p className="mafia-night__confirm-text">Выбор сохранён</p>
            <button
              type="button"
              className="btn btn--primary mafia-night__confirm-btn"
              onClick={() => {
                hapticSelection()
                goToNextNightStep()
              }}
            >
              Продолжить
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="mafia-night">
        <div className="mafia-night__top">
          <HomeButton />
          <button type="button" className="btn btn--ghost mafia-night__back" onClick={handleBack}>
            ← В меню
          </button>
        </div>
        <p className="mafia-night__progress">Ночь — шаг 1 / {nightSteps.length}</p>
        <div className="mafia-night__choice card">
          <h2 className="mafia-night__phase-title">Мафия, выберите жертву</h2>
          <div className="mafia-night__targets">
            {targets.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`btn card mafia-night__target ${state.nightAction.mafiaTarget === p.id ? 'is-active' : ''}`}
                onClick={() => {
                  hapticSelection()
                  dispatch({ type: 'SET_NIGHT_MAFIA', target: p.id })
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          className="btn btn--primary mafia-night__next"
          onClick={() => {
            hapticSelection()
            if (hasSelection) setShowConfirm(true)
          }}
          disabled={!hasSelection}
        >
          Продолжить
        </button>
      </div>
    )
  }

  // night_doctor_intro
  if (state.phase === 'night_doctor_intro' && doctor) {
    return (
      <div className="mafia-night">
        <div className="mafia-night__top">
          <HomeButton />
          <button type="button" className="btn btn--ghost mafia-night__back" onClick={handleBack}>
            ← В меню
          </button>
        </div>
        <p className="mafia-night__progress">Ночь — шаг 2 / {nightSteps.length}</p>
        <div className="mafia-night__intercept card">
          <h2 className="mafia-night__intercept-title">Ход: Доктор</h2>
          <p className="mafia-night__intercept-phrase">Жизнь висит на волоске.</p>
          <p className="mafia-night__intercept-instruction">Кого вы спасёте этой ночью?</p>
          <button
            type="button"
            className="btn btn--primary mafia-night__intercept-btn"
            onClick={() => {
              hapticSelection()
              dispatch({ type: 'SET_PHASE', phase: 'night_doctor' })
            }}
          >
            Начать
          </button>
        </div>
      </div>
    )
  }

  // night_doctor — выбор кого лечить
  if (state.phase === 'night_doctor' && doctor) {
    const hasSelection = state.nightAction.doctorTarget != null

    if (showConfirm && hasSelection) {
      return (
        <div className="mafia-night">
          <div className="mafia-night__top">
            <HomeButton />
            <button type="button" className="btn btn--ghost mafia-night__back" onClick={handleBack}>
              ← В меню
            </button>
          </div>
          <p className="mafia-night__progress">Ночь — шаг 2 / {nightSteps.length}</p>
          <div className="mafia-night__confirm card">
            <p className="mafia-night__confirm-text">Выбор сохранён</p>
            <button
              type="button"
              className="btn btn--primary mafia-night__confirm-btn"
              onClick={() => {
                hapticSelection()
                goToNextNightStep()
              }}
            >
              Продолжить
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="mafia-night">
        <div className="mafia-night__top">
          <HomeButton />
          <button type="button" className="btn btn--ghost mafia-night__back" onClick={handleBack}>
            ← В меню
          </button>
        </div>
        <p className="mafia-night__progress">Ночь — шаг 2 / {nightSteps.length}</p>
        <div className="mafia-night__choice card">
          <h2 className="mafia-night__phase-title">Доктор, кого лечить?</h2>
          <div className="mafia-night__targets">
            {alive.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`btn card mafia-night__target ${state.nightAction.doctorTarget === p.id ? 'is-active' : ''}`}
                onClick={() => {
                  hapticSelection()
                  dispatch({ type: 'SET_NIGHT_DOCTOR', target: p.id })
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          className="btn btn--primary mafia-night__next"
          onClick={() => {
            hapticSelection()
            if (hasSelection) setShowConfirm(true)
          }}
          disabled={!hasSelection}
        >
          Продолжить
        </button>
      </div>
    )
  }

  // night_sheriff_intro
  if (state.phase === 'night_sheriff_intro' && sheriff) {
    return (
      <div className="mafia-night">
        <div className="mafia-night__top">
          <HomeButton />
          <button type="button" className="btn btn--ghost mafia-night__back" onClick={handleBack}>
            ← В меню
          </button>
        </div>
        <p className="mafia-night__progress">Ночь — шаг 3 / {nightSteps.length}</p>
        <div className="mafia-night__intercept card">
          <h2 className="mafia-night__intercept-title">Ход: Шериф</h2>
          <p className="mafia-night__intercept-phrase">Закон не спит.</p>
          <p className="mafia-night__intercept-instruction">Проверьте, кто скрывает правду.</p>
          <button
            type="button"
            className="btn btn--primary mafia-night__intercept-btn"
            onClick={() => {
              hapticSelection()
              dispatch({ type: 'SET_PHASE', phase: 'night_sheriff' })
            }}
          >
            Начать
          </button>
        </div>
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
        <div className="mafia-night">
          <div className="mafia-night__top">
            <HomeButton />
            <button type="button" className="btn btn--ghost mafia-night__back" onClick={handleBack}>
              ← В меню
            </button>
          </div>
          <p className="mafia-night__progress">Ночь — шаг 3 / {nightSteps.length}</p>
          <div className="mafia-night__confirm card">
            <p className="mafia-night__confirm-text">Выбор сохранён</p>
            {checkedPlayer && sheriffResult !== null && (
              <p className="mafia-night__sheriff-result mafia-night__sheriff-result--in-confirm">
                {checkedPlayer.name}: {sheriffResult ? '🔴 Мафия' : '🟢 Мирный'}
              </p>
            )}
            <button
              type="button"
              className="btn btn--primary mafia-night__confirm-btn"
              onClick={() => {
                hapticSelection()
                goToNextNightStep()
              }}
            >
              Продолжить
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="mafia-night">
        <div className="mafia-night__top">
          <HomeButton />
          <button type="button" className="btn btn--ghost mafia-night__back" onClick={handleBack}>
            ← В меню
          </button>
        </div>
        <p className="mafia-night__progress">Ночь — шаг 3 / {nightSteps.length}</p>
        <div className="mafia-night__choice card">
          <h2 className="mafia-night__phase-title">Шериф, кого проверить?</h2>
          <div className="mafia-night__targets">
            {targets.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`btn card mafia-night__target ${sheriffTarget === p.id ? 'is-active' : ''}`}
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
          </div>
        </div>
        <button
          type="button"
          className="btn btn--primary mafia-night__next"
          onClick={() => {
            hapticSelection()
            if (hasSelection) setShowConfirm(true)
          }}
          disabled={!hasSelection}
        >
          Подтвердить
        </button>
      </div>
    )
  }

  return null
}

export default MafiaNight
