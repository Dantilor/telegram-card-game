import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBack } from '../hooks/useBack'
import { usePremium } from '../contexts/PremiumContext'
import {
  RUSSIA_TRAVEL_DECKS,
  getRussiaTravelCardCount,
  isRussiaTravelDeckLocked,
} from '../data/russiaTravel'
import { hapticSelection } from '../utils/haptics'
import { isGameLocked } from '../utils/access'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
import GamesPageHeader from '../components/GamesPageHeader'
import PremiumOverlay from '../components/PremiumOverlay'
import '../styles/GamePageShell.css'
import './RussiaTravel.css'

const DECK_EMOJI: Record<string, string> = {
  cities: '🏙️',
  landmarks: '🏛️',
  'hidden-russia': '🌲',
  'true-or-myth': '📜',
  'dream-route': '🗺️',
}

export default function RussiaTravel() {
  const navigate = useNavigate()
  const handleBack = useBack('/games')
  const { isPremium } = usePremium()
  const [premiumOverlayOpen, setPremiumOverlayOpen] = useState(false)
  const gameLocked = isGameLocked('russia-travel', isPremium)

  const openDeck = (deckId: string, deckLocked: boolean) => {
    hapticSelection()
    if (gameLocked || deckLocked) {
      setPremiumOverlayOpen(true)
      return
    }
    navigate(`/russia-travel/play/${deckId}`)
  }

  return (
    <div className="game-page rt-page game-page--enter">
      <div className="game-page__top">
        <HomeButton className="game-page__nav-btn" />
        <BackButton onClick={handleBack} className="game-page__nav-btn game-page__back" />
      </div>

      <GamesPageHeader title="Где мы?" tagline="Города, места и легенды России" />

      <div className="rt-page__hero rt-travel-card">
        <div className="rt-page__hero-body">
          <span className="rt-page__hero-icon" aria-hidden>
            🧭
          </span>
          <p className="rt-page__hero-text">
            Выберите маршрут — угадывайте города, открывайте места и спорьте о фактах вместе с
            компанией.
          </p>
        </div>
        <span className="rt-route-line rt-page__hero-route" aria-hidden />
      </div>

      <section className="game-page__section rt-page__section">
        <h2 className="game-page__section-title rt-page__section-title">
          <span className="rt-deco rt-deco--star" aria-hidden />
          Маршруты
        </h2>
        <ul className="rt-page__decks">
          {RUSSIA_TRAVEL_DECKS.map((deck) => {
            const locked = gameLocked || isRussiaTravelDeckLocked(deck, isPremium)
            const cardCount = getRussiaTravelCardCount(deck.id)
            const badgeLabel = deck.isPremium ? 'Premium' : 'Free'

            return (
              <li key={deck.id}>
                <article
                  className={`rt-page__deck rt-travel-card${locked ? ' rt-page__deck--locked' : ''}`}
                >
                  <span className="rt-deco rt-deco--pin rt-page__deck-pin" aria-hidden />
                  <span className="rt-route-line rt-page__deck-route" aria-hidden />
                  <div className="rt-page__deck-top">
                    <span className="rt-page__deck-emoji" aria-hidden>
                      {DECK_EMOJI[deck.id] ?? '📍'}
                    </span>
                    <div className="rt-page__deck-head">
                      <h3 className="rt-page__deck-title">{deck.title}</h3>
                      <span
                        className={`rt-page__badge${deck.isPremium ? ' rt-page__badge--premium' : ' rt-page__badge--free'}`}
                      >
                        {badgeLabel}
                      </span>
                    </div>
                  </div>
                  <p className="rt-page__deck-desc">{deck.description}</p>
                  <p className="rt-page__deck-meta">{cardCount} карточек</p>
                  <button
                    type="button"
                    className="rt-page__deck-cta"
                    onClick={() => openDeck(deck.id, locked)}
                  >
                    {locked ? 'Открыть Premium' : 'Открыть маршрут'}
                  </button>
                </article>
              </li>
            )
          })}
        </ul>
      </section>

      <PremiumOverlay isOpen={premiumOverlayOpen} onClose={() => setPremiumOverlayOpen(false)} />
    </div>
  )
}
