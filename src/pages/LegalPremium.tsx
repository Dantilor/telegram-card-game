import { useBack } from '../hooks/useBack'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
import '../styles/GamePageShell.css'
import './Legal.css'

export default function LegalPremium() {
  const handleBack = useBack('/profile')

  return (
    <div className="game-page legal-page game-page--enter">
      <div className="game-page__top">
        <HomeButton className="game-page__nav-btn" />
        <BackButton onClick={handleBack} className="game-page__nav-btn game-page__back" />
      </div>
      <h1 className="legal-page__title">Условия Premium</h1>
      <div className="legal-page__content game-page__panel game-page__panel--glow-a">
        <p>Premium — подписка, которая открывает полный доступ ко всем играм, колодам и функциям приложения.</p>
        <h2>Тарифы</h2>
        <p>Доступны тарифы на 1 месяц, 3 месяца и навсегда. Актуальные цены указаны на экране оформления подписки в приложении.</p>
        <h2>Условия подписки</h2>
        <ul>
          <li>Оплата производится через ЮKassa (картой или другими способами)</li>
          <li>При продлении новый срок добавляется к текущему активному периоду</li>
        </ul>
        <h2>Восстановление покупки</h2>
        <p>Если Premium не отображается после оплаты, откройте раздел «Профиль» и нажмите «Восстановить покупки». Если проблема остаётся — напишите в поддержку: <a href="https://t.me/GameNightHelp" target="_blank" rel="noopener noreferrer">@GameNightHelp</a></p>
        <h2>Поддержка</h2>
        <p>Вопросы по подписке и оплате: <a href="https://t.me/GameNightHelp" target="_blank" rel="noopener noreferrer">@GameNightHelp</a></p>
      </div>
    </div>
  )
}
