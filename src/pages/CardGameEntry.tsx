import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MODES } from '../data/modes'
import { useBack } from '../hooks/useBack'
import { usePremium } from '../contexts/PremiumContext'
import { isModeLocked } from '../utils/access'
import type { ModeId } from '../data/modes'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import PremiumOverlay from '../components/PremiumOverlay'
import './CardGameEntry.css'

function CardGameEntry() {
  const handleBack = useBack('/games')
  const { isPremium } = usePremium()
  const [premiumOverlayOpen, setPremiumOverlayOpen] = useState(false)

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
        {MODES.map((mode) => {
          const locked = isModeLocked(mode.id as ModeId, isPremium)
          if (locked) {
            return (
              <button
                key={mode.id}
                type="button"
                className="card-entry-page__mode-card card tile--active card-entry-page__mode-card--locked"
                onClick={() => {
                  hapticSelection()
                  setPremiumOverlayOpen(true)
                }}
              >
                <span className="card-entry-page__emoji" aria-hidden>{mode.emoji}</span>
                <span className="card-entry-page__mode-title">{mode.title}</span>
                <span className="badge badge--premium">Premium</span>
              </button>
            )
          }
          return (
            <Link
              key={mode.id}
              to={`/mode/${mode.id}`}
              className="card-entry-page__mode-card card tile--active"
              onClick={() => hapticSelection()}
            >
              <span className="card-entry-page__emoji" aria-hidden>{mode.emoji}</span>
              <span className="card-entry-page__mode-title">{mode.title}</span>
            </Link>
          )
        })}
      </div>
      <PremiumOverlay isOpen={premiumOverlayOpen} onClose={() => setPremiumOverlayOpen(false)} />
    </div>
  )
}

export default CardGameEntry
