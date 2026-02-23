import { useNavigate } from 'react-router-dom'
import { getTg } from '../utils/telegram'
import { useMafiaGame } from '../games/mafia/MafiaGameContext'
import { ROLE_LABELS } from '../games/mafia/types'
import { IMAGES } from '../assets/images'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import './MafiaResult.css'

function MafiaResult() {
  const navigate = useNavigate()
  const { state, dispatch } = useMafiaGame()
  const isPeacefulWin = state.winner === 'peaceful'

  const handlePlayAgain = () => {
    hapticSelection()
    dispatch({ type: 'RESET' })
    navigate('/mafia')
  }

  const handleBackToGames = () => {
    haptic('light')
    dispatch({ type: 'RESET' })
    // В Telegram WebView navigate(-1) ломает приложение — всегда явный путь
    if (getTg() || window.history.length <= 1) {
      navigate('/games')
    } else {
      navigate(-1)
    }
  }

  const roleEmoji: Record<string, string> = {
    civilian: '👤',
    mafia: '🌙',
    doctor: '💊',
    sheriff: '⭐',
  }

  return (
    <div className="mafia-result">
      <div className="mafia-result__top">
        <HomeButton />
        <button
          type="button"
          className="btn btn--ghost mafia-result__back"
          onClick={() => { haptic('light'); dispatch({ type: 'RESET' }); navigate('/mafia') }}
        >
          ← Назад
        </button>
      </div>

      <div className={`mafia-result__card card ${isPeacefulWin ? 'mafia-result__card--win' : 'mafia-result__card--lose'}`}>
        <h1 className="mafia-result__title">
          {isPeacefulWin ? 'Победа мирных' : 'Победа мафии'}
        </h1>
        {isPeacefulWin ? (
          <>
            <p className="mafia-result__subtitle">Справедливость восторжествовала.</p>
            <p className="mafia-result__subtitle">Город спасён.</p>
          </>
        ) : (
          <>
            <p className="mafia-result__subtitle">Город пал.</p>
            <p className="mafia-result__subtitle">Тьма победила.</p>
          </>
        )}
      </div>

      <div className="mafia-result__roles card">
        <h2 className="mafia-result__roles-title">Кто кем был</h2>
        <ul className="mafia-result__roles-list">
          {state.players.map((p) => (
            <li key={p.id} className="mafia-result__roles-item">
              {p.role === 'doctor' ? (
                <img src={IMAGES.mafiaDoctor.png} alt="" className="mafia-result__roles-icon mafia-result__roles-icon--img" />
              ) : p.role === 'mafia' ? (
                <img src={IMAGES.mafiaRole.png} alt="" className="mafia-result__roles-icon mafia-result__roles-icon--img" />
              ) : p.role === 'sheriff' ? (
                <img src={IMAGES.mafiaSheriff.png} alt="" className="mafia-result__roles-icon mafia-result__roles-icon--img" />
              ) : p.role === 'civilian' && (p.civilianImageIndex === 0 || p.civilianImageIndex === 1) ? (
                <img
                  src={p.civilianImageIndex === 1 ? IMAGES.mafiaCivilian2.png : IMAGES.mafiaCivilian1.png}
                  alt=""
                  className="mafia-result__roles-icon mafia-result__roles-icon--img"
                />
              ) : (
                <span className="mafia-result__roles-emoji" aria-hidden>{roleEmoji[p.role]}</span>
              )}
              <span className="mafia-result__roles-name">{p.name}</span>
              <span className="mafia-result__roles-role">{ROLE_LABELS[p.role]}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mafia-result__actions">
        <button
          type="button"
          className="btn btn--primary mafia-result__btn"
          onClick={handlePlayAgain}
        >
          Сыграть ещё раз
        </button>
        <button
          type="button"
          className="btn btn--ghost mafia-result__btn"
          onClick={handleBackToGames}
        >
          В меню игр
        </button>
      </div>
    </div>
  )
}

export default MafiaResult
