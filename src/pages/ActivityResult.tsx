import { useNavigate } from 'react-router-dom'
import { useActivityStateContext } from '../games/activity/ActivityStateContext'
import { saveActivityState, getInitialActivityState } from '../games/activity/state'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import './ActivityResult.css'

function ActivityResult() {
  const navigate = useNavigate()
  const { state, dispatch } = useActivityStateContext()

  const teamsWithScores = state.activeTeamSlots
    .map((slotIdx) => ({
      name: state.teams[slotIdx]?.name.trim() || `Команда ${slotIdx + 1}`,
      score: state.teamScores[slotIdx] ?? 0,
      guessed: state.teamGuessed[slotIdx] ?? 0,
    }))
    .sort((a, b) => b.score - a.score)

  const winner = teamsWithScores[0]
  const hasWinner = teamsWithScores.length > 0 && teamsWithScores[0]!.score > 0

  const handlePlayAgain = () => {
    hapticSelection()
    dispatch({ type: 'START_NEXT_ROUND' })
    navigate('/activity/play')
  }

  const handleBackToMenu = () => {
    haptic('light')
    const initialState = getInitialActivityState()
    saveActivityState(initialState)
    dispatch({ type: 'RESET_ALL' })
    navigate('/games')
  }

  const handleHomeClick = () => {
    const initialState = getInitialActivityState()
    saveActivityState(initialState)
    dispatch({ type: 'RESET_ALL' })
    return false
  }

  return (
    <div className="game-page activity-result game-page--enter">
      <div className="game-page__top game-page__top--solo">
        <HomeButton className="game-page__nav-btn" onBeforeNavigate={handleHomeClick} />
      </div>

      <header className="activity-result__header">
        <h1 className="activity-result__title">Игра окончена!</h1>
        {hasWinner && (
          <div className="activity-result__winner">
            <span className="activity-result__winner-label">Победитель</span>
            <span className="activity-result__winner-name">{winner?.name}</span>
            <span className="activity-result__winner-score">{winner?.score} очков</span>
          </div>
        )}
      </header>

      <section className="activity-result__scores">
        <h2 className="activity-result__scores-title">Результаты</h2>
        <div className="activity-result__scores-list">
          {teamsWithScores.map((team, index) => (
            <div
              key={index}
              className={`activity-result__score-row game-page__panel game-page__panel--glow-a ${index === 0 ? 'activity-result__score-row--winner' : ''}`}
            >
              <div className="activity-result__score-position">{index + 1}</div>
              <div className="activity-result__score-info">
                <span className="activity-result__score-name">{team.name}</span>
                <span className="activity-result__score-guessed">Угадано: {team.guessed}</span>
              </div>
              <div className="activity-result__score-value">{team.score}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="activity-result__actions">
        <button
          type="button"
          className="game-page__cta"
          onClick={handlePlayAgain}
        >
          Играть ещё
        </button>
        <button
          type="button"
          className="game-page__btn game-page__btn--secondary"
          onClick={handleBackToMenu}
        >
          Назад в меню
        </button>
      </div>
    </div>
  )
}

export default ActivityResult
