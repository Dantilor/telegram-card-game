import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useMafiaGame } from '../games/mafia/MafiaGameContext'
import { hapticSelection } from '../utils/haptics'
import { HOST_RULES } from '../games/mafia/hostScript'
import MafiaPageNav from '../components/MafiaPageNav'
import MafiaHostLine from '../components/MafiaHostLine'
import './MafiaDay.css'

function MafiaDay() {
  const navigate = useNavigate()
  const { state, dispatch } = useMafiaGame()

  useEffect(() => {
    if (!state.players.length) {
      navigate('/mafia')
    }
  }, [state.players.length, navigate])
  const [secondsLeft, setSecondsLeft] = useState(state.discussionSeconds)
  const endAtRef = useRef(Date.now() + state.discussionSeconds * 1000)

  useEffect(() => {
    endAtRef.current = Date.now() + state.discussionSeconds * 1000
    setSecondsLeft(state.discussionSeconds)
  }, [state.discussionSeconds])

  useEffect(() => {
    const iv = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000))
      setSecondsLeft(remaining)
    }, 500)
    return () => clearInterval(iv)
  }, [])

  const location = useLocation()
  useEffect(() => {
    if (state.winner && location.pathname !== '/mafia/result') {
      navigate('/mafia/result')
    }
  }, [state.winner, location.pathname, navigate])

  const handleVoting = () => {
    hapticSelection()
    dispatch({ type: 'SET_PHASE', phase: 'voting_collect' })
    navigate('/mafia/voting')
  }

  return (
    <div className="mafia-page mafia-day">
      <MafiaPageNav />

      <MafiaHostLine hostName={state.hostName}>
        «Город просыпается!» Огласите итог ночи вслух, затем дайте время на обсуждение.
      </MafiaHostLine>

      <div className="mafia-day__result mafia-page__panel mafia-page__panel--glow-a">
        <h2 className="mafia-day__result-title">День {state.roundNumber}</h2>
        <p className="mafia-day__result-text">{state.nightResult ?? 'Ночь завершена.'}</p>
      </div>

      <div className="mafia-day__timer mafia-page__panel mafia-page__panel--glow-b">
        <span className="mafia-day__timer-label">Обсуждение</span>
        <span className="mafia-day__timer-value">{Math.floor(secondsLeft / 60)}:{(secondsLeft % 60).toString().padStart(2, '0')}</span>
        <p className="mafia-day__timer-hint">{HOST_RULES.dayFlow}</p>
      </div>

      <div className="mafia-page__actions mafia-day__actions">
        <button
          type="button"
          className="mafia-page__cta"
          onClick={handleVoting}
        >
          Начать голосование
        </button>
      </div>
    </div>
  )
}

export default MafiaDay
