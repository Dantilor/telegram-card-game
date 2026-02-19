import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMafiaGame } from '../games/mafia/MafiaGameContext'
import { useBack } from '../hooks/useBack'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
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

  useEffect(() => {
    if (state.winner) {
      navigate('/mafia/result')
    }
  }, [state.winner, navigate])

  const handleVoting = () => {
    hapticSelection()
    dispatch({ type: 'SET_PHASE', phase: 'voting_collect' })
    navigate('/mafia/voting')
  }

  const handleBack = useBack('/mafia/night')

  return (
    <div className="mafia-day">
      <div className="mafia-day__top">
        <HomeButton />
        <button type="button" className="btn btn--ghost mafia-day__back" onClick={handleBack}>
          ← В меню
        </button>
      </div>

      <div className="mafia-day__result card">
        <h2 className="mafia-day__result-title">Город просыпается.</h2>
        <p className="mafia-day__result-text">Кто-то больше не откроет глаза.</p>
        {state.nightResult && <p className="mafia-day__result-night">{state.nightResult}</p>}
      </div>

      <div className="mafia-day__timer card">
        <span className="mafia-day__timer-label">День. Обсуждение</span>
        <span className="mafia-day__timer-value">{Math.floor(secondsLeft / 60)}:{(secondsLeft % 60).toString().padStart(2, '0')}</span>
      </div>

      <button
        type="button"
        className="btn btn--primary mafia-day__vote-btn"
        onClick={handleVoting}
      >
        Перейти к голосованию
      </button>
    </div>
  )
}

export default MafiaDay
