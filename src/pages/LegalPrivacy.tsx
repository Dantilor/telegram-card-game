import { useBack } from '../hooks/useBack'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
import '../styles/GamePageShell.css'
import './Legal.css'

export default function LegalPrivacy() {
  const handleBack = useBack('/profile')

  return (
    <div className="game-page legal-page game-page--enter">
      <div className="game-page__top">
        <HomeButton className="game-page__nav-btn" />
        <BackButton onClick={handleBack} className="game-page__nav-btn game-page__back" />
      </div>
      <h1 className="legal-page__title">Политика конфиденциальности</h1>
      <div className="legal-page__content game-page__panel game-page__panel--glow-a">
        <p>Мы заботимся о вашей конфиденциальности и обрабатываем только те данные, которые необходимы для работы приложения.</p>
        <h2>Какие данные мы используем</h2>
        <ul>
          <li>Ваш аккаунт в Telegram — для входа и отображения профиля</li>
          <li>Информация о действиях в приложении — чтобы улучшать игры и интерфейс</li>
          <li>Данные об оплате Premium — только служебные идентификаторы для подтверждения подписки (банковские реквизиты не хранятся)</li>
        </ul>
        <h2>Для чего это нужно</h2>
        <ul>
          <li>Чтобы вы могли играть и пользоваться Premium-функциями</li>
          <li>Чтобы мы могли помогать с вопросами и восстановлением покупок</li>
          <li>Чтобы развивать приложение и делать его удобнее</li>
        </ul>
        <h2>Контакты</h2>
        <p>По любым вопросам о данных и подписке: <a href="https://t.me/GameNightHelp" target="_blank" rel="noopener noreferrer">@GameNightHelp</a></p>
      </div>
    </div>
  )
}
