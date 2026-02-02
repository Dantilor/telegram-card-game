import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMafiaGame } from '../games/mafia/MafiaGameContext'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import './MafiaNight.css'

const INTRO_SEC = 3

function MafiaNight() {
  const navigate = useNavigate()
  const { state, dispatch } = useMafiaGame()
  const [introLeft, setIntroLeft] = useState(INTRO_SEC)

  if (!state.players.length) {
    navigate('/mafia')
    return null
  }

  const alive = state.players.filter((p) => p.alive)
  const mafia = alive.filter((p) => p.role === 'mafia')
  const doctor = alive.find((p) => p.role === 'doctor' && p.alive)
  const sheriff = alive.find((p) => p.role === 'sheriff' && p.alive)

  useEffect(() => {
    if (state.phase !== 'night_intro') return
    setIntroLeft(INTRO_SEC)
    const iv = setInterval(() => {
      setIntroLeft((s) => {
        if (s <= 1) {
          clearInterval(iv)
          dispatch({ type: 'SET_PHASE', phase: 'night_mafia' })
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [state.phase, dispatch])

  useEffect(() => {
    if (state.winner) {
      navigate('/mafia/result')
      return
    }
    if (state.phase === 'day') {
      navigate('/mafia/day')
    }
  }, [state.phase, state.winner, navigate])

  const handleBack = () => {
    haptic('light')
    navigate('/mafia')
  }

  if (state.phase === 'night_intro') {
    return (
      <div className="mafia-night mafia-night--dark">
        <div className="mafia-night__intro card">
          <h2 className="mafia-night__intro-title">Ночь</h2>
          <p className="mafia-night__intro-text">Все закрывают глаза</p>
          <p className="mafia-night__intro-timer">{introLeft}</p>
        </div>
        <div className="mafia-night__top">
          <HomeButton />
          <button type="button" className="btn btn--ghost mafia-night__back" onClick={handleBack}>
            ← В меню
          </button>
        </div>
      </div>
    )
  }

  if (state.phase === 'night_mafia' && mafia.length > 0) {
    const targets = alive.filter((p) => p.role !== 'mafia')
    return (
      <div className="mafia-night mafia-night--dark">
        <div className="mafia-night__top">
          <HomeButton />
          <button type="button" className="btn btn--ghost mafia-night__back" onClick={handleBack}>
            ← В меню
          </button>
        </div>
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
        <button
          type="button"
          className="btn btn--primary mafia-night__next"
          onClick={() => {
            hapticSelection()
            if (doctor) {
              dispatch({ type: 'SET_PHASE', phase: 'night_doctor' })
            } else if (sheriff) {
              dispatch({ type: 'SET_PHASE', phase: 'night_sheriff' })
            } else {
              dispatch({ type: 'APPLY_NIGHT' })
            }
          }}
        >
          {doctor ? 'Доктор' : sheriff ? 'Шериф' : 'Результат'}
        </button>
      </div>
    )
  }

  if (state.phase === 'night_doctor') {
    return (
      <div className="mafia-night mafia-night--dark">
        <div className="mafia-night__top">
          <HomeButton />
          <button type="button" className="btn btn--ghost mafia-night__back" onClick={handleBack}>
            ← В меню
          </button>
        </div>
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
        <button
          type="button"
          className="btn btn--primary mafia-night__next"
          onClick={() => {
            hapticSelection()
            if (sheriff) {
              dispatch({ type: 'SET_PHASE', phase: 'night_sheriff' })
            } else {
              dispatch({ type: 'APPLY_NIGHT' })
            }
          }}
        >
          {sheriff ? 'Шериф' : 'Результат ночи'}
        </button>
      </div>
    )
  }

  if (state.phase === 'night_sheriff') {
    const sheriffTarget = state.nightAction.sheriffTarget
    const sheriffResult = state.nightAction.sheriffResult
    const targets = alive.filter((p) => p.role !== 'sheriff')

    return (
      <div className="mafia-night mafia-night--dark">
        <div className="mafia-night__top">
          <HomeButton />
          <button type="button" className="btn btn--ghost mafia-night__back" onClick={handleBack}>
            ← В меню
          </button>
        </div>
        <h2 className="mafia-night__phase-title">Шериф, кого проверить?</h2>
        <div className="mafia-night__targets">
          {targets.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`btn card mafia-night__target ${sheriffTarget === p.id ? 'is-active' : ''}`}
              onClick={() => {
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
        {sheriffTarget && sheriffResult !== null && (
          <div className="mafia-night__sheriff-result card">
            {sheriffResult ? '🔴 Мафия' : '🟢 Мирный'}
          </div>
        )}
        <button
          type="button"
          className="btn btn--primary mafia-night__next"
          onClick={() => {
            hapticSelection()
            dispatch({ type: 'APPLY_NIGHT' })
          }}
        >
          Результат ночи
        </button>
      </div>
    )
  }

  return null
}

export default MafiaNight
