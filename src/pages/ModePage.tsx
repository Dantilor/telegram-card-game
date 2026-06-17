import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getDecksByMode } from '../data/decksIndex'
import { MODES } from '../data/modes'
import { getDeckFull } from '../data/decks'
import { useLocalState } from '../hooks/useLocalState'
import { useBack } from '../hooks/useBack'
import { usePremium } from '../contexts/PremiumContext'
import { defaultUserState, type UserState } from '../data/types'
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

function DeckSelectNav({ onBack }: { onBack: () => void }) {
  return (
    <div className="deck-select-page__top">
      <HomeButton className="deck-select-page__nav-btn" />
      <BackButton onClick={onBack} className="deck-select-page__nav-btn deck-select-page__back" />
    </div>
  )
}

function FavoritesLink({
  locked,
  onPremium,
}: {
  locked: boolean
  onPremium: () => void
}) {
  if (locked) {
    return (
      <div className="deck-select-page__header-extra">
        <button type="button" className="deck-select-page__favorites" onClick={onPremium}>
          Моё избранное
        </button>
      </div>
    )
  }
  return (
    <div className="deck-select-page__header-extra">
      <Link to="/favorites" className="deck-select-page__favorites" onClick={() => haptic('light')}>
        Моё избранное
      </Link>
    </div>
  )
}

function ModePage() {
  const navigate = useNavigate()
  const { modeId } = useParams<{ modeId: string }>()
  const [localState] = useLocalState<UserState>('tcg_state', defaultUserState)
  const { isPremium } = usePremium()
  const [premiumOverlayOpen, setPremiumOverlayOpen] = useState(false)

  const mode = MODES.find((m) => m.id === modeId)
  const decks = modeId ? getDecksByMode(modeId as ModeId) : []

  const [adultConfirmOpen, setAdultConfirmOpen] = useState(false)
  const [pendingDeckId, setPendingDeckId] = useState<string | null>(null)

  const handleBack = useBack('/card')
  const favoritesLocked = isFavoritesLocked(isPremium)

  const isAdultContent = (deck: { id: string; adult?: boolean }) =>
    deck.adult || modeId === 'adult'

  const handleDeckClick = (deckId: string, e: React.MouseEvent) => {
    hapticSelection()
    const deck = decks.find((d) => d.id === deckId)
    if (deck && isAdultContent(deck)) {
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

  const getProgressIndex = (deckId: string): number => {
    const p = localState.progress?.[deckId]
    return p != null && typeof p.index === 'number' ? p.index : 0
  }

  const openPremium = () => {
    hapticSelection()
    setPremiumOverlayOpen(true)
  }

  const renderDeckCard = (
    deck: (typeof decks)[0],
    i: number,
    linkContent: React.ReactNode,
  ) => (
    <li
      key={deck.id}
      className={`deck-select-page__card deck-select-page__card--glow-${i % 2 === 0 ? 'a' : 'b'}`}
      style={{ animationDelay: `${i * 0.05}s` }}
    >
      {linkContent}
    </li>
  )

  const renderDeckInner = (deck: (typeof decks)[0], locked: boolean) => {
    const progressIndex = getProgressIndex(deck.id)
    const hasProgress = progressIndex > 0
    const fullDeck = getDeckFull(deck.id)
    const questionsCount = fullDeck?.questions?.length ?? 0
    const description = fullDeck?.description

    return (
      <>
        <span className="deck-select-page__chip" aria-hidden>{DECK_ICONS[deck.id] ?? '📇'}</span>
        <div className="deck-select-page__card-body">
          <div className="deck-select-page__card-head">
            <h2 className="deck-select-page__card-title">{deck.title}</h2>
            {hasProgress && <span className="deck-select-page__continue">Продолжить</span>}
          </div>
          {description && <p className="deck-select-page__card-desc">{description}</p>}
        </div>
        <div className="deck-select-page__card-meta">
          {questionsCount > 0 ? (
            <span className="deck-select-page__count">{questionsCount}</span>
          ) : (
            <span className="deck-select-page__count deck-select-page__count--stub">—</span>
          )}
          {(deck.adult || locked) && (
            <div className="deck-select-page__badges">
              {deck.adult && <span className="deck-select-page__badge deck-select-page__badge--adult">18+</span>}
              {locked && <span className="deck-select-page__badge deck-select-page__badge--premium">PREMIUM</span>}
            </div>
          )}
        </div>
      </>
    )
  }

  if (!mode) {
    return (
      <div className="deck-select-page">
        <DeckSelectNav onBack={handleBack} />
        <p className="deck-select-page__error">Режим не найден</p>
        <button type="button" className="btn btn--primary" onClick={() => navigate('/')}>
          На главную
        </button>
      </div>
    )
  }

  return (
    <div className="deck-select-page">
      <DeckSelectNav onBack={handleBack} />

      <GamesPageHeader title={mode.title} tagline="Выбери колоду" />

      <FavoritesLink
        locked={favoritesLocked}
        onPremium={() => {
          haptic('light')
          setPremiumOverlayOpen(true)
        }}
      />

      <ul className="deck-select-page__list">
        {decks.map((deck, i) => {
          const fullDeck = getDeckFull(deck.id)
          const questionsCount = fullDeck?.questions?.length ?? 0
          const isStub = deck.isPremium && questionsCount === 0
          const locked = isDeckLocked(modeId as ModeId, deck.id, isPremium)
          const inner = renderDeckInner(deck, locked)

          if (locked) {
            return renderDeckCard(
              deck,
              i,
              <button type="button" className="deck-select-page__card-link" onClick={openPremium}>
                {inner}
              </button>,
            )
          }

          if (isStub) {
            return renderDeckCard(
              deck,
              i,
              <button
                type="button"
                className="deck-select-page__card-link"
                onClick={() => {
                  hapticSelection()
                  if (isAdultContent(deck)) {
                    setPendingDeckId(deck.id)
                    setAdultConfirmOpen(true)
                  } else {
                    navigate(`/play/${deck.id}`)
                  }
                }}
              >
                {inner}
              </button>,
            )
          }

          if (isAdultContent(deck)) {
            return renderDeckCard(
              deck,
              i,
              <button
                type="button"
                className="deck-select-page__card-link"
                onClick={(e) => handleDeckClick(deck.id, e)}
              >
                {inner}
              </button>,
            )
          }

          return renderDeckCard(
            deck,
            i,
            <Link
              to={`/play/${deck.id}`}
              className="deck-select-page__card-link"
              onClick={(e) => handleDeckClick(deck.id, e)}
            >
              {inner}
            </Link>,
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

export default ModePage
