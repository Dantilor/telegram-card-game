import { useState } from 'react'
import { Link } from 'react-router-dom'
import { decks } from '../data/decks'
import { getDeckFromIndex } from '../data/decksIndex'
import { useBack } from '../hooks/useBack'
import { useLocalState } from '../hooks/useLocalState'
import { defaultUserState, type UserState } from '../data/types'
import { isDeckLocked, isFavoritesLocked } from '../utils/access'
import type { ModeId } from '../data/modes'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import PremiumOverlay from '../components/PremiumOverlay'
import './Decks.css'

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
  const handleBack = useBack('/games')
  const [state] = useLocalState<UserState>('tcg_state', defaultUserState)
  const [premiumOverlayOpen, setPremiumOverlayOpen] = useState(false)

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
        {isFavoritesLocked(state.premium) ? (
          <button
            type="button"
            className="btn btn--ghost decks-page__my-link"
            onClick={() => {
              haptic('light')
              setPremiumOverlayOpen(true)
            }}
          >
            Моё избранное
          </button>
        ) : (
          <Link to="/favorites" className="btn btn--ghost decks-page__my-link" onClick={() => haptic('light')}>
            Моё избранное
          </Link>
        )}
      </header>
      <ul className="decks-list">
        {decks.map((deck, i) => {
          const indexEntry = getDeckFromIndex(deck.id)
          const modeId = (indexEntry?.modeId ?? 'party') as ModeId
          const locked = isDeckLocked(modeId, deck.id, state.premium)

          if (locked) {
            return (
              <li
                key={deck.id}
                className={`deck-card card deck-card--locked ${deck.isPremium ? 'deck-card--premium' : ''}`}
                style={{ animationDelay: `${i * 0.06}s` }}
              >
                <button
                  type="button"
                  className="deck-card__link"
                  onClick={() => {
                    hapticSelection()
                    setPremiumOverlayOpen(true)
                  }}
                >
                  <span className="deck-card__chip" aria-hidden>
                    {DECK_ICONS[deck.id] ?? '📇'}
                  </span>
                  <div className="deck-card__body">
                    <div className="deck-card__header">
                      <h2 className="deck-card__title">{deck.title}</h2>
                    </div>
                    <p className="deck-card__description">{deck.description}</p>
                  </div>
                  <span className="deck-card__pill font-mono">{deck.questionsCount}</span>
                  <span className="badge badge--premium">Premium</span>
                </button>
              </li>
            )
          }
          return (
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
                  </div>
                  <p className="deck-card__description">{deck.description}</p>
                </div>
                <span className="deck-card__pill font-mono">{deck.questionsCount}</span>
              </Link>
            </li>
          )
        })}
      </ul>
      <PremiumOverlay isOpen={premiumOverlayOpen} onClose={() => setPremiumOverlayOpen(false)} />
    </div>
  )
}

export default Decks
