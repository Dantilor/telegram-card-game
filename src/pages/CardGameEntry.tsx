import { Link } from 'react-router-dom'
import { MODES } from '../data/modes'
import { useBack } from '../hooks/useBack'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import './CardGameEntry.css'

function CardGameEntry() {
  const handleBack = useBack('/games')

  return (
    <div className="card-entry-page">
      <div className="card-entry-page__top">
        <HomeButton />
        <button type="button" className="btn btn--ghost card-entry-page__back" onClick={handleBack}>
          ← Назад
        </button>
      </div>
      <header className="card-entry-page__header">
        <h1 className="card-entry-page__title">Карточная игра</h1>
        <p className="card-entry-page__tagline">Выбери режим</p>
      </header>
      <div className="card-entry-page__modes">
        {MODES.map((mode) => (
          <Link
            key={mode.id}
            to={`/mode/${mode.id}`}
            className="card-entry-page__mode-card card tile--active"
            onClick={() => hapticSelection()}
          >
            <span className="card-entry-page__emoji" aria-hidden>{mode.emoji}</span>
            <span className="card-entry-page__mode-title">{mode.title}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default CardGameEntry
