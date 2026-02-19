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
import SmartImage from '../components/SmartImage'
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
        <h1 className="card-entry-page__title">GameNight Cards</h1>
        <p className="card-entry-page__tagline">Выбери режим</p>
      </header>
      <div className="card-entry-page__modes">
        {MODES.map((mode) => {
          const locked = isModeLocked(mode.id as ModeId, isPremium)
          const modeContent = (
            <>
              {mode.image ? (
                <>
                  <div className="card-entry-page__mode-image-wrap">
                    <SmartImage src={mode.image} alt="" className="card-entry-page__mode-img" objectFit="contain" />
                  </div>
                  <div className="card-entry-page__mode-text">
                    <span className="card-entry-page__mode-title">{mode.title}</span>
                    {'description' in mode && mode.description && (
                      <span className="card-entry-page__mode-desc">{mode.description}</span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <span className="card-entry-page__emoji" aria-hidden>{mode.emoji}</span>
                  <span className="card-entry-page__mode-title">{mode.title}</span>
                </>
              )}
            </>
          )
          if (locked) {
            return (
              <button
                key={mode.id}
                type="button"
                className={`card-entry-page__mode-card card tile--active card-entry-page__mode-card--locked ${mode.image ? 'card-entry-page__mode-card--image' : ''}`}
                onClick={() => {
                  hapticSelection()
                  setPremiumOverlayOpen(true)
                }}
              >
                {modeContent}
                <span className="badge badge--premium">Premium</span>
              </button>
            )
          }
          return (
            <Link
              key={mode.id}
              to={`/mode/${mode.id}`}
              className={`card-entry-page__mode-card card tile--active ${mode.image ? 'card-entry-page__mode-card--image' : ''}`}
              onClick={() => hapticSelection()}
            >
              {modeContent}
            </Link>
          )
        })}
      </div>
      <PremiumOverlay isOpen={premiumOverlayOpen} onClose={() => setPremiumOverlayOpen(false)} />
    </div>
  )
}

export default CardGameEntry
