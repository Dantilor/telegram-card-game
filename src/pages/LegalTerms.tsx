import { useBack } from '../hooks/useBack'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
import '../styles/GamePageShell.css'
import './Legal.css'

export default function LegalTerms() {
  const handleBack = useBack('/profile')

  return (
    <div className="game-page legal-page game-page--enter">
      <div className="game-page__top">
        <HomeButton className="game-page__nav-btn" />
        <BackButton onClick={handleBack} className="game-page__nav-btn game-page__back" />
      </div>
      <h1 className="legal-page__title">Условия использования</h1>
      <div className="legal-page__content game-page__panel game-page__panel--glow-a">
        <p>Используя приложение, вы принимаете эти условия.</p>
        <p>Мы предоставляем игры и контент в рамках возможностей сервиса. Просим соблюдать авторские права и правила Telegram.</p>
        <h2>Контакты</h2>
        <p>По вопросам работы приложения: <a href="https://t.me/GameNightHelp" target="_blank" rel="noopener noreferrer">@GameNightHelp</a></p>
      </div>
    </div>
  )
}
