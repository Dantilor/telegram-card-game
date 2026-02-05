import { useBack } from '../hooks/useBack'
import HomeButton from '../components/HomeButton'
import './Legal.css'

export default function LegalPrivacy() {
  const handleBack = useBack('/profile')

  return (
    <div className="legal-page">
      <div className="legal-page__header">
        <HomeButton />
        <button type="button" className="btn btn--ghost legal-page__back" onClick={handleBack}>
          ← Назад
        </button>
        <h1 className="legal-page__title">Политика конфиденциальности</h1>
      </div>
      <div className="legal-page__content">
        <p><strong>Правообладатель:</strong> &lt;Имя/ИП/ООО&gt;</p>

        <h2>1. Какие данные собираются</h2>
        <ul>
          <li>Идентификатор Telegram (telegram_id) — для доступа к приложению и подписке</li>
          <li>События в приложении (аналитика) — какие игры открываются, действия пользователя</li>
          <li>Данные о платежах Telegram Stars — идентификаторы транзакций (без банковских данных) для подтверждения подписки</li>
        </ul>

        <h2>2. Цель обработки</h2>
        <ul>
          <li>Предоставление доступа к играм и Premium-функциям</li>
          <li>Поддержка пользователей (ответы на вопросы, восстановление покупок)</li>
          <li>Аналитика для улучшения приложения</li>
        </ul>

        <h2>3. Контакты</h2>
        <p>По вопросам обработки данных и поддержки: <a href="https://t.me/GameNightHostBot" target="_blank" rel="noopener noreferrer">@GameNightHostBot</a></p>
      </div>
    </div>
  )
}
