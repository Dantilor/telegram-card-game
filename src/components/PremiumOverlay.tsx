import { useEffect } from 'react'
import { PREMIUM_PLAN } from '../config/premium'
import { haptic } from '../utils/telegram'
import './PremiumOverlay.css'

type Props = {
  isOpen: boolean
  onClose: () => void
  /** Заглушка для будущего Telegram Payments. Пока не вызывает оплату. */
  onBuyPremium?: () => void
}

export default function PremiumOverlay({ isOpen, onClose, onBuyPremium }: Props) {
  useEffect(() => {
    if (isOpen) {
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose()
      }
      document.addEventListener('keydown', handleEsc)
      document.body.style.overflow = 'hidden'
      return () => {
        document.removeEventListener('keydown', handleEsc)
        document.body.style.overflow = ''
      }
    }
  }, [isOpen, onClose])

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      haptic('light')
      onClose()
    }
  }

  const handleBuyPremium = () => {
    haptic('medium')
    if (onBuyPremium) {
      onBuyPremium()
    } else {
      // TODO: подключить Telegram Payments
      console.log('[PremiumOverlay] onBuyPremium — заглушка')
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="premium-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="premium-overlay-title"
      onClick={handleBackdropClick}
    >
      <div className="premium-overlay__card" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="premium-overlay__close"
          onClick={() => {
            haptic('light')
            onClose()
          }}
          aria-label="Закрыть"
        >
          ✕
        </button>
        <h2 id="premium-overlay-title" className="premium-overlay__heading">
          <span className="premium-overlay__icon" aria-hidden>💎</span>
          Premium-доступ
        </h2>
        <p className="premium-overlay__subtitle">Этот контент доступен по подписке</p>
        <div className="premium-overlay__description">
          <p>
            С подпиской открывается полный доступ ко всем играм и режимам.
          </p>
          <p>Что входит в Premium:</p>
          <ul className="premium-overlay__includes">
            <li>Все темы и колоды в карточной игре</li>
            <li>Полный доступ к играм для компании, пар и вечеринок</li>
            <li>Alias / Крокодил</li>
            <li>Мафия</li>
            <li>Activity</li>
            <li>Саботаж</li>
            <li>Викторина</li>
            <li>Правда или действие (расширенные наборы)</li>
            <li>Возможность добавлять вопросы в избранное и возвращаться к ним</li>
            <li>Новые игры и колоды, которые будут появляться со временем</li>
          </ul>
          <p className="premium-overlay__price">
            Стоимость подписки:<br />
            {PREMIUM_PLAN.priceRub} ₽ на {PREMIUM_PLAN.durationMonths} месяцев
          </p>
        </div>
        <p className="premium-overlay__footer">
          Вы можете продолжить играть бесплатно или открыть полный доступ
        </p>
        <button
          type="button"
          className="btn btn--primary premium-overlay__btn premium-overlay__btn--buy"
          onClick={handleBuyPremium}
        >
          Открыть Premium · {PREMIUM_PLAN.priceRub} ₽ / {PREMIUM_PLAN.durationMonths} месяцев
        </button>
        <button
          type="button"
          className="btn btn--ghost premium-overlay__btn"
          onClick={() => {
            haptic('light')
            onClose()
          }}
        >
          Понятно
        </button>
      </div>
    </div>
  )
}
