import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { decks } from '../data/decks'
import { getDeckFromIndex, isDeckAdult } from '../data/decksIndex'
import { useBack } from '../hooks/useBack'
import { usePremium } from '../contexts/PremiumContext'
import { isDeckLocked, isFavoritesLocked } from '../utils/access'
import type { ModeId } from '../data/modes'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
import GamesPageHeader from '../components/GamesPageHeader'
import PremiumOverlay from '../components/PremiumOverlay'
import AdultConfirmModal from '../components/AdultConfirmModal'
import './DeckSelectPage.css'

const DECK_ICONS: Record<string, string> = {
  aboutUs: '💕',
  feelings: '💗',
  past: '📜',
  future: '🔮',
  conflictsHonesty: '⚡',
  desiresDreams: '✨',
  iUnderstandYou: '💬',
  sparkFirstImpression: '💫',
  lightFlirt: '😏',
  genuineInterest: '🔍',
  emotionsCloseness: '🤗',
  personalLight: '🌿',
  whatIfIntrigue: '💫',
  sincereFinal: '🌙',
  mostLikely: '🎲',
  factsAboutUs: '📋',
  lifeStories: '📖',
  awkwardSituations: '😅',
  funnyAccusations: '😏',
  voting: '🗳️',
  noFilter: '🔥',
  absurdHumor: '🤪',
  finalRound: '⚡',
  fantasies: '✨',
  taboo: '🚫',
  experience: '💡',
  boundaries: '🛡️',
  desires: '💝',
  roleplay: '🎭',
  provocations: '😈',
  honestlyOrSkip: '🤫',
  intimateWithoutWords: '👁️',
  whatIfScenarios: '🎬',
  fears: '🦋',
  confidence: '💪',
  values: '💎',
  choices: '🔀',
  personalBoundaries: '🚧',
  innerChild: '🌱',
  fatigue: '😴',
  wishes: '🌟',
  selfHonesty: '🪞',
  growth: '📈',
  career: '💼',
  money: '💰',
  relationships: '💫',
  freedom: '🕊️',
  responsibility: '⚖️',
  risk: '🎲',
  comfort: '🏠',
  happiness: '☀️',
  meaning: '🌌',
  decisiveChoice: '🎯',
}

function Decks() {
  const navigate = useNavigate()
  const handleBack = useBack('/games')
  const { isPremium } = usePremium()
  const [premiumOverlayOpen, setPremiumOverlayOpen] = useState(false)
  const [adultConfirmOpen, setAdultConfirmOpen] = useState(false)
  const [pendingDeckId, setPendingDeckId] = useState<string | null>(null)
  const favoritesLocked = isFavoritesLocked(isPremium)

  const handleDeckClick = (deckId: string, e: React.MouseEvent) => {
    hapticSelection()
    if (isDeckAdult(deckId)) {
      e.preventDefault()
      setPendingDeckId(deckId)
      setAdultConfirmOpen(true)
    }
  }

  const handleAdultConfirm = () => {
    setAdultConfirmOpen(false)
    if (pendingDeckId) {
      navigate(`/play/${pendingDeckId}`, { state: { adultConfirmed: true } })
      setPendingDeckId(null)
    }
  }

  const handleAdultCancel = () => {
    setAdultConfirmOpen(false)
    setPendingDeckId(null)
  }

  return (
    <div className="deck-select-page">
      <div className="deck-select-page__top">
        <HomeButton className="deck-select-page__nav-btn" />
        <BackButton onClick={handleBack} className="deck-select-page__nav-btn deck-select-page__back" />
      </div>

      <GamesPageHeader title="Card Game" tagline="Выбери колоду" />

      <div className="deck-select-page__header-extra">
        {favoritesLocked ? (
          <button
            type="button"
            className="deck-select-page__favorites"
            onClick={() => {
              haptic('light')
              setPremiumOverlayOpen(true)
            }}
          >
            Моё избранное
          </button>
        ) : (
          <Link to="/favorites" className="deck-select-page__favorites" onClick={() => haptic('light')}>
            Моё избранное
          </Link>
        )}
      </div>

      <ul className="deck-select-page__list">
        {decks.map((deck, i) => {
          const indexEntry = getDeckFromIndex(deck.id)
          const modeId = (indexEntry?.modeId ?? 'party') as ModeId
          const locked = isDeckLocked(modeId, deck.id, isPremium)
          const isAdult = isDeckAdult(deck.id)

          const inner = (
            <>
              <span className="deck-select-page__chip" aria-hidden>{DECK_ICONS[deck.id] ?? '📇'}</span>
              <div className="deck-select-page__card-body">
                <h2 className="deck-select-page__card-title">{deck.title}</h2>
                <p className="deck-select-page__card-desc">{deck.description}</p>
              </div>
              <div className="deck-select-page__card-meta">
                <span className="deck-select-page__count">{deck.questionsCount}</span>
                {(isAdult || locked) && (
                  <div className="deck-select-page__badges">
                    {isAdult && <span className="deck-select-page__badge deck-select-page__badge--adult">18+</span>}
                    {locked && <span className="deck-select-page__badge deck-select-page__badge--premium">PREMIUM</span>}
                  </div>
                )}
              </div>
            </>
          )

          return (
            <li
              key={deck.id}
              className={`deck-select-page__card deck-select-page__card--glow-${i % 2 === 0 ? 'a' : 'b'}`}
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              {locked ? (
                <button
                  type="button"
                  className="deck-select-page__card-link"
                  onClick={() => {
                    hapticSelection()
                    setPremiumOverlayOpen(true)
                  }}
                >
                  {inner}
                </button>
              ) : (
                <Link
                  to={`/play/${deck.id}`}
                  className="deck-select-page__card-link"
                  onClick={(e) => handleDeckClick(deck.id, e)}
                >
                  {inner}
                </Link>
              )}
            </li>
          )
        })}
      </ul>

      <PremiumOverlay isOpen={premiumOverlayOpen} onClose={() => setPremiumOverlayOpen(false)} />
      <AdultConfirmModal
        isOpen={adultConfirmOpen}
        onConfirm={handleAdultConfirm}
        onCancel={handleAdultCancel}
      />
    </div>
  )
}

export default Decks
