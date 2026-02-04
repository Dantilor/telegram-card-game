import { useBack } from '../hooks/useBack'
import { usePremium } from '../contexts/PremiumContext'
import { getTgUser, getInitData } from '../utils/telegram'
import ThemeToggle from '../components/ThemeToggle'
import HomeButton from '../components/HomeButton'
import './Profile.css'

function Profile() {
  const handleBack = useBack('/')
  const user = getTgUser()
  const { isPremium, activeUntil, authError, authError401 } = usePremium()
  const userId = getInitData().userId

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

      {authError && (
        <p className="profile-card__hint" style={{ marginTop: '0.5rem', color: 'var(--accent, #ff6b9d)' }}>
          {authError401 ? 'Не удалось подтвердить Telegram initData' : 'Откройте приложение внутри Telegram'}
        </p>
      )}
      <section className={`profile-premium ${isPremium ? 'profile-premium--active' : ''}`}>
        {isPremium ? (
          <p className="profile-premium__status-only">
            Premium: активен
            {activeUntil && (
              <span style={{ display: 'block', fontSize: '0.85em', opacity: 0.8 }}>
                до {new Date(activeUntil).toLocaleDateString('ru-RU')}
              </span>
            )}
          </p>
        ) : (
          <>
            <h2 className="profile-premium__heading">
              <span className="profile-premium__icon" aria-hidden>💎</span>
              Premium-доступ
            </h2>
            <p className="profile-premium__status">Статус: не активен</p>
            <div className="profile-premium__description">
              <p>
                Открой полный доступ ко всем играм и режимам без ограничений.
              </p>
              <p>В подписку входит:</p>
              <ul className="profile-premium__includes">
                <li>Разблокировка всех тем в карточных играх</li>
                <li>Доступ к играм для компании, пар и вечеринок</li>
                <li>Возможность добавлять интересные вопросы в избранное и просматривать их в любое время</li>
              </ul>
              <p>Игры и режимы:</p>
              <ul className="profile-premium__games">
                <li>Колоды вопросов</li>
                <li>Alias / Крокодил</li>
                <li>Мафия</li>
                <li>Activity</li>
                <li>Саботаж</li>
                <li>Викторина</li>
                <li>Правда или действие</li>
              </ul>
              <p className="profile-premium__footer">
                Подписка открывает весь контент и новые наборы, которые будут появляться со временем.
              </p>
            </div>
          </>
        )}
      </section>
      {import.meta.env.DEV && userId != null && (
        <p className="profile-card__hint" style={{ marginTop: '0.5rem', fontSize: '0.8rem', opacity: 0.7 }}>
          id {userId}
        </p>
      )}
    </div>
  )
}

export default Profile
