import { useNavigate } from 'react-router-dom'
import { useLocalState } from '../hooks/useLocalState'
import { getTgUser, haptic } from '../utils/telegram'
import { defaultUserState, type UserState } from '../data/types'
import ThemeToggle from '../components/ThemeToggle'
import HomeButton from '../components/HomeButton'
import './Profile.css'

function Profile() {
  const navigate = useNavigate()
  const user = getTgUser()
  const [state, setState] = useLocalState<UserState>('tcg_state', defaultUserState)

  const handleBack = () => {
    haptic('light')
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/decks')
    }
  }

  const handleResetProgress = () => {
    setState({ ...state, progress: {} })
  }

  const handleClearFavorites = () => {
    setState({ ...state, favorites: {} })
  }

  const handleResetAll = () => {
    setState(defaultUserState)
  }

  return (
    <div className="profile-page">
      <div className="profile-page__header">
        <HomeButton />
        <button type="button" className="btn btn--ghost profile-page__back" onClick={handleBack}>
          ← Назад
        </button>
        <h1 className="profile-page__title">Профиль</h1>
        <ThemeToggle />
      </div>

      <section className="profile-card">
        <h2 className="profile-card__heading">Пользователь</h2>
        {user ? (
          <div className="profile-card__user">
            {user.photo_url && (
              <img
                src={user.photo_url}
                alt=""
                className="profile-card__photo"
              />
            )}
            <div className="profile-card__user-info">
              <p className="profile-card__name">
                {user.first_name}
                {user.last_name ? ` ${user.last_name}` : ''}
              </p>
              {user.username && (
                <p className="profile-card__username">@{user.username}</p>
              )}
            </div>
          </div>
        ) : (
          <p className="profile-card__hint">
            Откройте Mini App в Telegram, чтобы подтянуть профиль
          </p>
        )}
      </section>

      <section className="profile-card">
        <h2 className="profile-card__heading">Состояние</h2>
        <p className="profile-card__row">
          <span className="profile-card__label">Premium:</span>{' '}
          {state.premium ? 'да' : 'нет'}
        </p>
        <div className="profile-card__actions">
          <button
            type="button"
            className="btn btn--ghost profile-card__btn"
            onClick={handleResetProgress}
          >
            Сбросить прогресс
          </button>
          <button
            type="button"
            className="btn btn--ghost profile-card__btn"
            onClick={handleClearFavorites}
          >
            Очистить избранное
          </button>
          <button
            type="button"
            className="btn btn--danger profile-card__btn"
            onClick={handleResetAll}
          >
            Сбросить всё
          </button>
        </div>
      </section>
    </div>
  )
}

export default Profile
