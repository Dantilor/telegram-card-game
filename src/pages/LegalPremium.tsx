import { useBack } from '../hooks/useBack'
import { PREMIUM_PLAN } from '../config/premium'
import HomeButton from '../components/HomeButton'
import './Legal.css'

export default function LegalPremium() {
  const handleBack = useBack('/profile')

  return (
    <div className="legal-page">
      <div className="legal-page__header">
        <HomeButton />
        <button type="button" className="btn btn--ghost home-btn legal-page__back" onClick={handleBack}>
          ← Назад
        </button>
        <h1 className="legal-page__title">Условия Premium</h1>
      </div>
      <div className="legal-page__content">
        <p>Premium — подписка, которая открывает полный доступ ко всем играм, колодам и функциям приложения.</p>

        <h2>Условия подписки</h2>
        <ul>
          <li>Срок действия: {PREMIUM_PLAN.durationMonths} месяцев</li>
          <li>Оплата производится через ЮKassa (картой или другими способами)</li>
        </ul>

        <h2>Восстановление покупки</h2>
        <p>Если Premium не отображается после оплаты, откройте раздел «Профиль» и нажмите «Восстановить покупки». Если проблема остаётся — напишите в поддержку: <a href="https://t.me/GameNightHostBot" target="_blank" rel="noopener noreferrer">@GameNightHostBot</a></p>

        <h2>Поддержка</h2>
        <p>Вопросы по подписке и оплате: <a href="https://t.me/GameNightHostBot" target="_blank" rel="noopener noreferrer">@GameNightHostBot</a></p>
      </div>
    </div>
  )
}
