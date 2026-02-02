import { useNavigate, useLocation } from 'react-router-dom'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import './ActivityResult.css'

function ActivityResult() {
  const navigate = useNavigate()
  const location = useLocation()
  const { scores = { teamA: 0, teamB: 0 }, mode = 'solo' } = (location.state as {
    scores?: { teamA: number; teamB: number }
    mode?: 'solo' | 'team'
  }) ?? {}

  const total = mode === 'team'
    ? scores.teamA + scores.teamB
    : scores.teamA

  const handlePlayAgain = () => {
    hapticSelection()
    navigate('/activity')
  }

  const handleBack = () => {
    haptic('light')
    navigate('/games')
  }

  return (
    <div className="activity-result">
      <div className="activity-result__top">
        <HomeButton />
        <button
          type="button"
          className="btn btn--ghost activity-result__back"
          onClick={() => navigate('/activity')}
        >
          ← Назад
        </button>
      </div>

      <div className="activity-result__card card">
        <h1 className="activity-result__title">Игра окончена</h1>
        {mode === 'team' ? (
          <div className="activity-result__scores">
            <p>Команда A: {scores.teamA}</p>
            <p>Команда B: {scores.teamB}</p>
          </div>
        ) : (
          <p className="activity-result__score">Очки: {total}</p>
        )}
      </div>

      <div className="activity-result__actions">
        <button
          type="button"
          className="btn btn--primary activity-result__btn"
          onClick={handlePlayAgain}
        >
          Играть ещё
        </button>
        <button
          type="button"
          className="btn btn--ghost activity-result__btn"
          onClick={handleBack}
        >
          Назад в меню
        </button>
      </div>
    </div>
  )
}

export default ActivityResult
