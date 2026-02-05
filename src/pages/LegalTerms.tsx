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
        <p><strong>Правообладатель:</strong> &lt;Имя/ИП/ООО&gt;</p>

        <p>Используя приложение, вы соглашаетесь с условиями. Контент предоставляется «как есть». Запрещается нарушать авторские права и правила Telegram.</p>

        <h2>Контакты</h2>
        <p>Поддержка: <a href="https://t.me/GameNightHostBot" target="_blank" rel="noopener noreferrer">@GameNightHostBot</a></p>
      </div>
    </div>
  )
}
