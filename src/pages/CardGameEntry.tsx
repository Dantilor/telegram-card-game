import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MODES } from '../data/modes'
import { useBack } from '../hooks/useBack'
import { usePremium } from '../contexts/PremiumContext'
import { isModeLocked } from '../utils/access'
import type { ModeId } from '../data/modes'
import { hapticSelection } from '../utils/haptics'
import { formatGameTags } from '../utils/gameTags'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
import GamesPageHeader from '../components/GamesPageHeader'
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
        <HomeButton className="card-entry-page__nav-btn" />
        <BackButton onClick={handleBack} className="card-entry-page__nav-btn card-entry-page__back" />
      </div>

      <GamesPageHeader title="GameNight Cards" tagline="Выбери режим" />

      <div className="card-entry-page__grid">
        {MODES.map((mode, idx) => {
          const locked = isModeLocked(mode.id as ModeId, isPremium)
          const cardClass = `card-entry-page__card card-entry-page__card--glow-${idx % 2 === 0 ? 'a' : 'b'}`
          const cardContent = (
            <>
              <div className="card-entry-page__card-image-wrap">
                <SmartImage
                  src={mode.image}
                  alt=""
                  className="card-entry-page__card-img"
                  aspectRatio=""
                  objectFit="cover"
                  priority={idx < 4}
                />
                {(mode.id === 'adult' || locked) && (
                  <div className="card-entry-page__card-badges">
                    {mode.id === 'adult' && (
                      <span className="card-entry-page__badge card-entry-page__badge--adult">18+</span>
                    )}
                    {locked && (
                      <span className="card-entry-page__badge card-entry-page__badge--premium">PREMIUM</span>
                    )}
                  </div>
                )}
              </div>
              <div className="card-entry-page__card-body">
                <h2 className="card-entry-page__card-title">{mode.title}</h2>
                {'description' in mode && mode.description && (
                  <p className="card-entry-page__card-desc">{formatGameTags(mode.description)}</p>
                )}
              </div>
            </>
          )

          if (locked) {
            return (
              <button
                key={mode.id}
                type="button"
                className={cardClass}
                style={{ animationDelay: `${idx * 0.05}s` }}
                onClick={() => {
                  hapticSelection()
                  setPremiumOverlayOpen(true)
                }}
              >
                {cardContent}
              </button>
            )
          }

          return (
            <Link
              key={mode.id}
              to={mode.id === 'adult' ? '#' : `/mode/${mode.id}`}
              className={cardClass}
              style={{ animationDelay: `${idx * 0.05}s` }}
              onClick={(e) => handleModeClick(mode.id, e)}
            >
              {cardContent}
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
