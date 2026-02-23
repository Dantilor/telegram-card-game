import { Link, useNavigate } from 'react-router-dom'
import { useCustomDecks } from '../hooks/useCustomDecks'
import { haptic } from '../utils/telegram'
import HomeButton from '../components/HomeButton'
import './MyDecks.css'

function MyDecks() {
  const navigate = useNavigate()
  const { decks } = useCustomDecks()

  const handleBack = () => {
    haptic('light')
    if (window.history.length > 1) navigate(-1)
    else navigate('/decks')
  }

  return (
    <div className="my-decks-page">
      <div className="my-decks-page__top">
        <HomeButton />
        <button type="button" className="btn btn--ghost home-btn my-decks-page__back" onClick={handleBack}>
          ← Назад
        </button>
      </div>
      <h1 className="my-decks-page__title">Мои колоды</h1>
      <Link
        to="/decks/custom/new"
        className="btn btn--primary my-decks-page__create"
        onClick={() => haptic('light')}
      >
        ➕ Создать колоду
      </Link>
      {decks.length === 0 ? (
        <div className="my-decks-page__empty card">
          <p className="my-decks-page__empty-text">Создай свою первую колоду 💜</p>
          <Link
            to="/decks/custom/new"
            className="btn btn--ghost"
            onClick={() => haptic('light')}
          >
            Создать колоду
          </Link>
        </div>
      ) : (
        <ul className="my-decks-list">
          {decks.map((deck) => (
            <li key={deck.id} className="my-decks-item card">
              <Link to={`/play/${deck.id}`} className="my-decks-item__link">
                <span className="my-decks-item__title">{deck.title}</span>
                <span className="my-decks-item__count font-mono">{deck.questions.length}</span>
              </Link>
              <Link
                to={`/decks/custom/${deck.id}/edit`}
                className="btn btn--ghost my-decks-item__edit"
                onClick={() => haptic('light')}
              >
                Редактировать
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default MyDecks
