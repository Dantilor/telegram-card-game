import { Link, useNavigate } from 'react-router-dom'
import { decks } from '../data/decks'
import { haptic } from '../utils/telegram'
import HomeButton from '../components/HomeButton'
import './Decks.css'

const DECK_ICONS: Record<string, string> = {
  couples: '💑',
  friends: '👥',
  party: '🎉',
  self: '🪞',
  intimacy: '💜',
}

function Decks() {
  const navigate = useNavigate()

  const handleBack = () => {
    haptic('light')
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/')
    }
  }

  return (
    <div className="decks-page">
      <div className="decks-page__top">
        <HomeButton />
        <button type="button" className="btn btn--ghost decks-page__back" onClick={handleBack}>
          ← Назад
        </button>
      </div>
      <header className="decks-page__header">
        <h1 className="decks-page__title">Card Game</h1>
        <p className="decks-page__tagline">Выбери колоду и поехали</p>
        <Link to="/decks/custom" className="btn btn--ghost decks-page__my-link" onClick={() => haptic('light')}>
          Мои колоды
        </Link>
      </header>
      <ul className="decks-list">
        {decks.map((deck, i) => (
          <li
            key={deck.id}
            className={`deck-card card ${deck.isPremium ? 'deck-card--premium' : ''}`}
            style={{ animationDelay: `${i * 0.06}s` }}
          >
            <Link to={`/play/${deck.id}`} className="deck-card__link">
              <span className="deck-card__chip" aria-hidden>
                {DECK_ICONS[deck.id] ?? '📇'}
              </span>
              <div className="deck-card__body">
                <div className="deck-card__header">
                  <h2 className="deck-card__title">{deck.title}</h2>
                  {deck.isPremium && (
                    <span className="badge-premium">VIP</span>
                  )}
                </div>
                <p className="deck-card__description">{deck.description}</p>
              </div>
              <span className="deck-card__pill font-mono">{deck.questionsCount}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default Decks
