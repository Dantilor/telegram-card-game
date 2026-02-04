import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getDecksByMode } from '../data/decksIndex'
import { MODES } from '../data/modes'
import { getDeckFull } from '../data/decks'
import { useLocalState } from '../hooks/useLocalState'
import { useBack } from '../hooks/useBack'
import { defaultUserState, type UserState } from '../data/types'
import { isDeckLocked, isFavoritesLocked } from '../utils/access'
import type { ModeId } from '../data/modes'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import PremiumOverlay from '../components/PremiumOverlay'
import './ModePage.css'

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

function ModePage() {
  const navigate = useNavigate()
  const { modeId } = useParams<{ modeId: string }>()
  const [localState] = useLocalState<UserState>('tcg_state', defaultUserState)
  const [premiumOverlayOpen, setPremiumOverlayOpen] = useState(false)

  const mode = MODES.find((m) => m.id === modeId)
  const decks = modeId ? getDecksByMode(modeId as import('../data/modes').ModeId) : []

  const handleBack = useBack('/card')

  const getProgressIndex = (deckId: string): number => {
    const p = localState.progress?.[deckId]
    return p != null && typeof p.index === 'number' ? p.index : 0
  }


  if (!mode) {
    return (
      <div className="mode-page">
        <div className="mode-page__top">
          <HomeButton />
          <button type="button" className="btn btn--ghost mode-page__back" onClick={handleBack}>
            ← Назад
          </button>
        </div>
        <p className="mode-page__error">Режим не найден</p>
        <button type="button" className="btn btn--primary" onClick={() => navigate('/')}>
          На главную
        </button>
      </div>
    )
  }

  return (
    <div className="mode-page">
      <div className="mode-page__top">
        <HomeButton />
        <button type="button" className="btn btn--ghost mode-page__back" onClick={handleBack}>
          ← Назад
        </button>
      </div>
      <header className="mode-page__header">
        <h1 className="mode-page__title">
          <span aria-hidden>{mode.emoji}</span> {mode.title}
        </h1>
        <p className="mode-page__tagline">Выбери колоду</p>
        {isFavoritesLocked(localState.premium) ? (
          <button
            type="button"
            className="btn btn--ghost mode-page__my-link"
            onClick={() => {
              haptic('light')
              setPremiumOverlayOpen(true)
            }}
          >
            Моё избранное
          </button>
        ) : (
          <Link to="/favorites" className="btn btn--ghost mode-page__my-link" onClick={() => haptic('light')}>
            Моё избранное
          </Link>
        )}
      </header>
      <ul className="mode-page__list">
        {decks.map((deck, i) => {
          const progressIndex = getProgressIndex(deck.id)
          const hasProgress = progressIndex > 0
          const fullDeck = getDeckFull(deck.id)
          const questionsCount = fullDeck?.questions?.length ?? 0
          const isStub = deck.isPremium && questionsCount === 0
          const description = fullDeck?.description

          const content = (
            <>
              <span className="mode-page__chip" aria-hidden>
                {DECK_ICONS[deck.id] ?? '📇'}
              </span>
              <div className="mode-page__body">
                <div className="mode-page__deck-header">
                  <h2 className="mode-page__deck-title">{deck.title}</h2>
                  {hasProgress && (
                    <span className="mode-page__continue">Продолжить</span>
                  )}
                </div>
                {description && (
                  <p className="mode-page__deck-desc">{description}</p>
                )}
              </div>
              {questionsCount > 0 ? (
                <span className="mode-page__pill font-mono">{questionsCount}</span>
              ) : (
                <span className="mode-page__pill mode-page__pill--stub">—</span>
              )}
            </>
          )

          const locked = isDeckLocked(modeId as ModeId, deck.id, localState.premium)

          if (locked) {
            return (
              <li
                key={deck.id}
                className={`mode-page__card card mode-page__card--locked ${deck.isPremium ? 'mode-page__card--premium' : ''}`}
                style={{ animationDelay: `${i * 0.06}s` }}
              >
                <button
                  type="button"
                  className="mode-page__link"
                  onClick={() => {
                    hapticSelection()
                    setPremiumOverlayOpen(true)
                  }}
                >
                  {content}
                  <span className="badge badge--premium">Premium</span>
                </button>
              </li>
            )
          }

          if (isStub) {
            return (
              <li
                key={deck.id}
                className={`mode-page__card card ${deck.isPremium ? 'mode-page__card--premium' : ''}`}
                style={{ animationDelay: `${i * 0.06}s` }}
              >
                <button
                  type="button"
                  className="mode-page__link"
                  onClick={() => {
                    hapticSelection()
                    navigate(`/play/${deck.id}`)
                  }}
                >
                  {content}
                </button>
              </li>
            )
          }

          return (
            <li
              key={deck.id}
              className={`mode-page__card card ${deck.isPremium ? 'mode-page__card--premium' : ''}`}
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              <Link to={`/play/${deck.id}`} className="mode-page__link" onClick={() => hapticSelection()}>
                {content}
              </Link>
            </li>
          )
        })}
      </ul>
      <PremiumOverlay isOpen={premiumOverlayOpen} onClose={() => setPremiumOverlayOpen(false)} />
    </div>
  )
}

export default ModePage
