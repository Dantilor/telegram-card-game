import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MODES } from '../data/modes'
import { useBack } from '../hooks/useBack'
import { usePremium } from '../contexts/PremiumContext'
import { isModeLocked } from '../utils/access'
import type { ModeId } from '../data/modes'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
import PremiumOverlay from '../components/PremiumOverlay'
import AdultConfirmModal from '../components/AdultConfirmModal'
import SmartImage from '../components/SmartImage'
import './CardGameEntry.css'

function CardGameEntry() {
  const navigate = useNavigate()
  const handleBack = useBack('/games')
  const { isPremium } = usePremium()
  const [premiumOverlayOpen, setPremiumOverlayOpen] = useState(false)
  const [adultConfirmOpen, setAdultConfirmOpen] = useState(false)
  const [pendingAdultMode, setPendingAdultMode] = useState<string | null>(null)

  const handleModeClick = (modeId: string, e: React.MouseEvent) => {
    hapticSelection()
    if (modeId === 'adult') {
      e.preventDefault()
      setPendingAdultMode(modeId)
      setAdultConfirmOpen(true)
      return
    }
  }

  const handleAdultConfirm = () => {
    setAdultConfirmOpen(false)
    if (pendingAdultMode) {
      navigate(`/mode/${pendingAdultMode}`)
      setPendingAdultMode(null)
    }
  }

  const handleAdultCancel = () => {
    setAdultConfirmOpen(false)
    setPendingAdultMode(null)
  }

  return (
    <div className="card-entry-page">
      <div className="card-entry-page__top">
        <HomeButton />
        <BackButton onClick={handleBack} className="card-entry-page__back" />
      </div>
      <header className="card-entry-page__header">
        <h1 className="card-entry-page__title">GameNight Cards</h1>
        <p className="card-entry-page__tagline">Выбери режим</p>
      </header>
      <div className="card-entry-page__modes">
        {MODES.map((mode, idx) => {
          const locked = isModeLocked(mode.id as ModeId, isPremium)
          const modeContent = (
            <>
              {mode.image ? (
                <>
                  <div className="card-entry-page__mode-image-wrap">
                    <SmartImage
                      src={mode.image}
                      alt=""
                      className="card-entry-page__mode-img"
                      objectFit="cover"
                      priority={idx < 4}
                    />
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
          const hasBadges = mode.id === 'adult' || locked
          const badges = hasBadges ? (
            <div className="card-entry-page__badges">
              {mode.id === 'adult' && <span className="badge badge--adult">18+</span>}
              {locked && <span className="badge badge--premium">Premium</span>}
            </div>
          ) : null
          if (locked) {
            return (
              <button
                key={mode.id}
                type="button"
                className={`card-entry-page__mode-card card tile--active card-entry-page__mode-card--locked ${mode.image ? 'card-entry-page__mode-card--image' : ''}`}
                style={{ animationDelay: `${idx * 0.06}s` }}
                onClick={() => {
                  hapticSelection()
                  setPremiumOverlayOpen(true)
                }}
              >
                {modeContent}
                {badges}
              </button>
            )
          }
          return (
            <Link
              key={mode.id}
              to={mode.id === 'adult' ? '#' : `/mode/${mode.id}`}
              className={`card-entry-page__mode-card card tile--active ${mode.image ? 'card-entry-page__mode-card--image' : ''}`}
              style={{ animationDelay: `${idx * 0.06}s` }}
              onClick={(e) => handleModeClick(mode.id, e)}
            >
              {modeContent}
              {badges}
            </Link>
          )
        })}
      </div>
      <PremiumOverlay isOpen={premiumOverlayOpen} onClose={() => setPremiumOverlayOpen(false)} />
      <AdultConfirmModal
        isOpen={adultConfirmOpen}
        onConfirm={handleAdultConfirm}
        onCancel={handleAdultCancel}
      />
    </div>
  )
}

export default CardGameEntry
