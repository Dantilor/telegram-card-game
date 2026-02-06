import { useBack } from '../hooks/useBack'
import HomeButton from '../components/HomeButton'
import './Legal.css'

export default function LegalTerms() {
  const handleBack = useBack('/profile')

  return (
    <div className="legal-page">
      <div className="legal-page__header">
        <HomeButton />
        <button type="button" className="btn btn--ghost legal-page__back" onClick={handleBack}>
          ← Назад
        </button>
        <h1 className="legal-page__title">Условия использования</h1>
      </div>
      <div className="legal-page__content">
        <p>Используя приложение, вы принимаете эти условия.</p>

        <p>Мы предоставляем игры и контент в рамках возможностей сервиса. Просим соблюдать авторские права и правила Telegram.</p>

        <h2>Контакты</h2>
        <p>По вопросам работы приложения: <a href="https://t.me/GameNightHostBot" target="_blank" rel="noopener noreferrer">@GameNightHostBot</a></p>
      </div>
    </div>
  )
}
