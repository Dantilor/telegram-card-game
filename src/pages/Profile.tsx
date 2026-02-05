import { useState, useCallback, useRef } from 'react'
import { useBack } from '../hooks/useBack'
import { usePremium } from '../contexts/PremiumContext'
import { getTelegramWebApp } from '../lib/telegram'
import { haptic, getTgUser, getInitData } from '../utils/telegram'
import ThemeToggle from '../components/ThemeToggle'
import HomeButton from '../components/HomeButton'
import PremiumOverlay from '../components/PremiumOverlay'
import './Profile.css'

const SUPPORT_BOT_URL = 'https://t.me/GameNightHostBot'

function Profile() {
  const handleBack = useBack('/')
  const user = getTgUser()
  const { isPremium, activeUntil, authError, authError401, serverError503, refreshPremium } = usePremium()
  const initData = getInitData()
  const userId = initData.userId ?? initData.user?.id
  const [premiumOverlayOpen, setPremiumOverlayOpen] = useState(false)
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null)
  const restoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleRestorePurchase = useCallback(() => {
    haptic('medium')
    if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current)
    setRestoreStatus(null)
    refreshPremium()
    setRestoreStatus('Обновлено')
    restoreTimerRef.current = setTimeout(() => {
      setRestoreStatus(null)
      restoreTimerRef.current = null
    }, 2500)
  }, [refreshPremium])

  const handleSupport = useCallback(() => {
    haptic('light')
    const tg = getTelegramWebApp()
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(SUPPORT_BOT_URL)
    } else {
      window.open(SUPPORT_BOT_URL, '_blank', 'noopener,noreferrer')
    }
  }, [])

  const getErrorMessage = () => {
    if (authError401) return 'Откройте внутри Telegram'
    if (serverError503) return 'Сервис временно недоступен, попробуйте позже'
    if (authError) return 'Откройте внутри Telegram'
    return null
  }

  return (
    <div className="profile-page">
      <div className="profile-page__header">
        <HomeButton />
        <button type="button" className="btn btn--ghost profile-page__back" onClick={handleBack}>
          ← Назад
        </button>
        <h1 className="profile-page__title">Профиль</h1>
        <ThemeToggle onPremiumRequired={() => setPremiumOverlayOpen(true)} />
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

      {getErrorMessage() && (
        <p className="profile-card__hint profile-card__hint--error">
          {getErrorMessage()}
        </p>
      )}

      <section className={`profile-premium ${isPremium ? 'profile-premium--active' : ''}`}>
        {isPremium ? (
          <div className="profile-premium__active">
            <p className="profile-premium__status-only">
              Premium активен до {activeUntil ? new Date(activeUntil).toLocaleDateString('ru-RU') : '—'}
            </p>
            <div className="profile-premium__actions">
              <button
                type="button"
                className="btn btn--ghost profile-premium__btn"
                onClick={handleRestorePurchase}
              >
                Восстановить покупку
              </button>
              {restoreStatus && (
                <span className="profile-premium__toast">{restoreStatus}</span>
              )}
            </div>
          </div>
        ) : (
          <div className="profile-premium__inactive">
            <h2 className="profile-premium__heading">
              <span className="profile-premium__icon" aria-hidden>💎</span>
              Premium-доступ
            </h2>
            <p className="profile-premium__status">Статус: не активен</p>
            <p className="profile-premium__short">
              Откройте полный доступ ко всем играм, колодам и избранному.
            </p>
            <button
              type="button"
              className="btn btn--primary profile-premium__btn"
              onClick={() => {
                haptic('medium')
                setPremiumOverlayOpen(true)
              }}
            >
              Оформить Premium
            </button>
            <button
              type="button"
              className="btn btn--ghost profile-premium__btn"
              onClick={handleRestorePurchase}
            >
              Восстановить покупку
            </button>
          </div>
        )}
      </section>

      <section className="profile-card profile-card--support">
        <h2 className="profile-card__heading">Поддержка</h2>
        <p className="profile-card__hint">
          Вопросы по подписке, восстановлению или работе приложения — напишите в поддержку.
        </p>
        <button
          type="button"
          className="btn btn--ghost profile-premium__btn"
          onClick={handleSupport}
        >
          Поддержка
        </button>
      </section>

      {import.meta.env.DEV && userId != null && (
        <p className="profile-card__hint" style={{ marginTop: '0.5rem', fontSize: '0.8rem', opacity: 0.7 }}>
          id {userId}
        </p>
      )}
      <PremiumOverlay isOpen={premiumOverlayOpen} onClose={() => setPremiumOverlayOpen(false)} />
    </div>
  )
}

export default Profile
