import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useBack } from '../hooks/useBack'
import { usePremium } from '../contexts/PremiumContext'
import {
  getRussiaTravelCardsByDeck,
  getRussiaTravelDeckById,
  isRussiaTravelDeckLocked,
  type RussiaTravelCard,
} from '../data/russiaTravel'
import {
  drawNextCard,
  getDeckProgress,
  loadDeckProgressMap,
  playedInDeck,
  resetDeckProgress,
  saveDeckProgressMap,
  type DeckProgressMap,
} from '../games/russia-travel/progress'
import { hapticSelection } from '../utils/haptics'
import { haptic } from '../utils/telegram'
import { isGameLocked } from '../utils/access'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
import GamesPageHeader from '../components/GamesPageHeader'
import PremiumOverlay from '../components/PremiumOverlay'
import '../styles/GamePageShell.css'
import './RussiaTravel.css'
import './RussiaTravelPlay.css'

const TYPE_LABEL: Record<RussiaTravelCard['type'], string> = {
  guess_city: 'Угадай город',
  guess_place: 'Угадай место',
  true_or_myth: 'Правда или миф',
  where_to_go: 'Маршрут мечты',
}

const DIFFICULTY_LABEL: Record<RussiaTravelCard['difficulty'], string> = {
  easy: 'Легко',
  medium: 'Средне',
  hard: 'Сложно',
}

export default function RussiaTravelPlay() {
  const { deckId = '' } = useParams<{ deckId: string }>()
  const navigate = useNavigate()
  const handleBackToDecks = useBack('/russia-travel')
  const { isPremium } = usePremium()

  const deck = useMemo(() => getRussiaTravelDeckById(deckId), [deckId])
  const cards = useMemo(() => getRussiaTravelCardsByDeck(deckId), [deckId])
  const gameLocked = isGameLocked('russia-travel', isPremium)
  const locked = gameLocked || (deck ? isRussiaTravelDeckLocked(deck, isPremium) : true)

  const [premiumOverlayOpen, setPremiumOverlayOpen] = useState(false)
  const [progressMap, setProgressMap] = useState<DeckProgressMap>(() => loadDeckProgressMap())
  const [currentCard, setCurrentCard] = useState<RussiaTravelCard | null>(null)
  const [revealAnswer, setRevealAnswer] = useState(false)
  const [mythChoice, setMythChoice] = useState<'truth' | 'myth' | null>(null)
  const [deckComplete, setDeckComplete] = useState(false)

  const progress = useMemo(
    () => (deck ? getDeckProgress(progressMap, deck.id, cards.length) : null),
    [progressMap, deck, cards.length],
  )

  const playedCount = progress ? playedInDeck(progress, cards.length) : 0

  const persistProgress = useCallback((map: DeckProgressMap) => {
    setProgressMap(map)
    saveDeckProgressMap(map)
  }, [])

  useEffect(() => {
    if (!deck || cards.length === 0) return

    if (gameLocked || isRussiaTravelDeckLocked(deck, isPremium)) {
      setPremiumOverlayOpen(true)
      return
    }

    const map = loadDeckProgressMap()
    let deckProgress = getDeckProgress(map, deck.id, cards.length)
    if (deckProgress.completed) {
      deckProgress = resetDeckProgress(deck.id, cards.length)
    }

    const drawn = drawNextCard(cards, deckProgress)
    if (!drawn) return

    const nextMap = { ...map, [deck.id]: drawn.progress }
    setProgressMap(nextMap)
    saveDeckProgressMap(nextMap)
    setCurrentCard(drawn.card)
    setRevealAnswer(false)
    setMythChoice(null)
    setDeckComplete(false)
  }, [deck, cards, isPremium])

  const resetCardState = () => {
    setRevealAnswer(false)
    setMythChoice(null)
  }

  const handleShowAnswer = () => {
    hapticSelection()
    setRevealAnswer(true)
  }

  const handleMythChoice = (choice: 'truth' | 'myth') => {
    hapticSelection()
    setMythChoice(choice)
    setRevealAnswer(true)
  }

  const handleNext = () => {
    if (!deck || cards.length === 0) return
    haptic('light')

    const deckProgress = getDeckProgress(progressMap, deck.id, cards.length)
    if (deckProgress.completed || deckProgress.remainingIndices.length === 0) {
      setDeckComplete(true)
      setCurrentCard(null)
      resetCardState()
      return
    }

    const drawn = drawNextCard(cards, deckProgress)
    if (!drawn) return

    persistProgress({ ...progressMap, [deck.id]: drawn.progress })
    setCurrentCard(drawn.card)
    resetCardState()
    setDeckComplete(drawn.progress.completed)
  }

  const handleRestart = () => {
    if (!deck) return
    hapticSelection()
    const fresh = resetDeckProgress(deck.id, cards.length)
    const drawn = drawNextCard(cards, fresh)
    if (!drawn) return
    persistProgress({ ...progressMap, [deck.id]: drawn.progress })
    setCurrentCard(drawn.card)
    resetCardState()
    setDeckComplete(false)
  }

  const handleBack = () => {
    hapticSelection()
    handleBackToDecks()
  }

  if (!deck) {
    return (
      <div className="game-page rt-play game-page--enter">
        <div className="game-page__top">
          <HomeButton className="game-page__nav-btn" />
          <BackButton onClick={handleBack} className="game-page__nav-btn game-page__back" />
        </div>
        <div className="rt-play__empty rt-travel-card">
          <p className="game-page__hint">Маршрут не найден.</p>
          <button type="button" className="game-page__cta" onClick={handleBack}>
            Назад к маршрутам
          </button>
        </div>
      </div>
    )
  }

  const showRevealButton =
    currentCard &&
    !revealAnswer &&
    currentCard.type !== 'true_or_myth' &&
    currentCard.type !== 'where_to_go'

  const revealLabel =
    currentCard?.type === 'where_to_go' ? 'Открыть обсуждение' : 'Показать ответ'

  return (
    <div className="game-page rt-play game-page--enter">
      <div className="game-page__top">
        <HomeButton className="game-page__nav-btn" />
        <BackButton onClick={handleBack} className="game-page__nav-btn game-page__back" />
      </div>

      <GamesPageHeader title={deck.title} tagline="Где мы?" />

      {progress && cards.length > 0 ? (
        <div className="rt-play__progress" aria-label="Прогресс маршрута">
          <span className="rt-deco rt-deco--compass rt-play__progress-compass" aria-hidden />
          <div className="rt-play__progress-track">
            <span className="rt-play__progress-dot" aria-hidden />
            <div className="rt-play__progress-bar">
              <span
                className="rt-play__progress-fill"
                style={{ width: `${Math.min(100, (playedCount / cards.length) * 100)}%` }}
              />
            </div>
            <span className="rt-play__progress-flag" aria-hidden>★</span>
          </div>
          <span className="rt-play__progress-text">
            {deckComplete ? 'Маршрут пройден' : `${playedCount}/${cards.length}`}
          </span>
        </div>
      ) : null}

      {deckComplete && !currentCard ? (
        <div className="rt-play__complete rt-travel-card">
          <span className="rt-play__complete-icon" aria-hidden>🎒</span>
          <h2 className="rt-play__complete-title">Маршрут пройден!</h2>
          <p className="game-page__hint">Все карточки этой колоды уже были в игре.</p>
          <div className="rt-play__actions">
            <button type="button" className="game-page__cta" onClick={handleRestart}>
              Пройти снова
            </button>
            <button type="button" className="rt-play__secondary" onClick={handleBack}>
              Назад к маршрутам
            </button>
          </div>
        </div>
      ) : currentCard ? (
        <>
          <article className="rt-play__card rt-postcard">
            <span className="rt-deco rt-deco--stamp rt-postcard__stamp" aria-hidden />
            <span className="rt-deco rt-deco--map rt-postcard__map" aria-hidden />
            <div className="rt-postcard__inner">
            <div className="rt-play__card-tags">
              <span className="rt-play__tag">{TYPE_LABEL[currentCard.type]}</span>
              <span className="rt-play__tag rt-play__tag--muted">
                {DIFFICULTY_LABEL[currentCard.difficulty]}
              </span>
            </div>
            <p className="rt-play__question">{currentCard.question}</p>

            {currentCard.hint && !revealAnswer ? (
              <p className="rt-play__hint">Подсказка: {currentCard.hint}</p>
            ) : null}

            {currentCard.type === 'true_or_myth' && !revealAnswer ? (
              <div className="rt-play__choice-row">
                <button
                  type="button"
                  className={`rt-play__choice${mythChoice === 'truth' ? ' is-active' : ''}`}
                  onClick={() => handleMythChoice('truth')}
                >
                  Правда
                </button>
                <button
                  type="button"
                  className={`rt-play__choice${mythChoice === 'myth' ? ' is-active' : ''}`}
                  onClick={() => handleMythChoice('myth')}
                >
                  Миф
                </button>
              </div>
            ) : null}

            {currentCard.type === 'where_to_go' && currentCard.options?.length ? (
              <ul className="rt-play__options">
                {currentCard.options.map((option) => (
                  <li key={option} className="rt-play__option">
                    {option}
                  </li>
                ))}
              </ul>
            ) : null}

            {revealAnswer ? (
              <div className="rt-play__reveal">
                {currentCard.answer ? (
                  <p className="rt-play__answer">
                    <span className="rt-play__answer-label">Ответ:</span> {currentCard.answer}
                  </p>
                ) : null}
                {currentCard.type === 'true_or_myth' && mythChoice && currentCard.answer ? (
                  <p className="rt-play__verdict">
                    {mythChoice === 'truth' && currentCard.answer.toLowerCase().includes('правда')
                      ? 'Верно!'
                      : mythChoice === 'myth' && currentCard.answer.toLowerCase().includes('миф')
                        ? 'Верно!'
                        : 'Посмотрите правильный ответ выше'}
                  </p>
                ) : null}
                {currentCard.fact ? (
                  <p className="rt-play__fact">
                    <span className="rt-play__fact-label">Факт:</span> {currentCard.fact}
                  </p>
                ) : null}
              </div>
            ) : null}
            </div>
            <span className="rt-route-line rt-postcard__route" aria-hidden />
          </article>

          <div className="rt-play__actions">
            {showRevealButton ? (
              <button type="button" className="game-page__cta" onClick={handleShowAnswer}>
                {revealLabel}
              </button>
            ) : null}

            {currentCard.type === 'where_to_go' && !revealAnswer ? (
              <button type="button" className="game-page__cta" onClick={handleShowAnswer}>
                {revealLabel}
              </button>
            ) : null}

            {currentCard.type === 'true_or_myth' && !revealAnswer ? (
              <button type="button" className="rt-play__secondary" onClick={handleShowAnswer}>
                Показать ответ
              </button>
            ) : null}

            {(revealAnswer) && (
              <button type="button" className="game-page__cta" onClick={handleNext}>
                Следующая
              </button>
            )}

            <button type="button" className="rt-play__secondary" onClick={handleBack}>
              Назад к маршрутам
            </button>
          </div>
        </>
      ) : null}

      <PremiumOverlay
        isOpen={premiumOverlayOpen || locked}
        onClose={() => {
          setPremiumOverlayOpen(false)
          if (locked) navigate('/russia-travel')
        }}
      />
    </div>
  )
}
