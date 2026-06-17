import { useCallback, useMemo, useState } from 'react'
import {
  FREEBIE_CATEGORIES,
  getFreebieCardCount,
  getFreebieCardsByCategory,
  getFreebieCategoryById,
} from '../../data/freebieTrash'
import { useBack } from '../../hooks/useBack'
import { haptic } from '../../utils/telegram'
import { hapticSelection } from '../../utils/haptics'
import HomeButton from '../../components/HomeButton'
import BackButton from '../../components/BackButton'
import GamesPageHeader from '../../components/GamesPageHeader'
import PremiumOverlay from '../../components/PremiumOverlay'
import { useGameStartGate } from '../../hooks/useGameStartGate'
import {
  drawNextCard,
  getCategoryProgress,
  loadCategoryProgressMap,
  playedInCategory,
  resetCategoryProgress,
  saveCategoryProgressMap,
} from './progress'
import type { CategoryProgressMap, FreebieCard, FreebieCategory, FreebieChoice, FreebieScreen } from './types'
import '../../styles/GamePageShell.css'
import './FreebieTrashGame.css'

const SELECTED_CATEGORY_KEY = 'freebie-trash:selected-category'

const TAKE_REACTIONS = [
  'Смелый выбор. Теперь объясни, зачем тебе это.',
  'Теперь защити свой выбор перед компанией.',
  'А теперь пусть остальные скажут, кто бы сделал так же.',
] as const

const SKIP_REACTIONS = [
  'Даже бесплатно не зашло. Расскажи, что смутило.',
  'Теперь защити свой выбор перед компанией.',
  'А теперь пусть остальные скажут, кто бы сделал так же.',
] as const

function loadSelectedCategoryId(): string {
  try {
    const raw = localStorage.getItem(SELECTED_CATEGORY_KEY)
    if (raw && getFreebieCategoryById(raw)) return raw
  } catch {
    /* ignore */
  }
  return FREEBIE_CATEGORIES[0].id
}

function saveSelectedCategoryId(categoryId: string): void {
  try {
    localStorage.setItem(SELECTED_CATEGORY_KEY, categoryId)
  } catch {
    /* ignore */
  }
}

function pickReaction(choice: FreebieChoice, cardId: string): string {
  const pool = choice === 'take' ? TAKE_REACTIONS : SKIP_REACTIONS
  const hash = cardId.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return pool[hash % pool.length]
}

function categoryStatusLabel(progressPlayed: number, total: number, completed: boolean): string {
  if (completed) return 'Пройдено'
  if (progressPlayed === 0) return `${total} карточек`
  return `${progressPlayed}/${total}`
}

export default function FreebieTrashGame() {
  const handleBackToGames = useBack('/games')

  const [screen, setScreen] = useState<FreebieScreen>('categories')
  const [selectedCategoryId, setSelectedCategoryId] = useState(loadSelectedCategoryId)
  const [progressMap, setProgressMap] = useState<CategoryProgressMap>(() => loadCategoryProgressMap())
  const [currentCard, setCurrentCard] = useState<FreebieCard | null>(null)
  const [selectedChoice, setSelectedChoice] = useState<FreebieChoice>(null)
  const [categoryComplete, setCategoryComplete] = useState(false)
  const { startLocked, premiumOverlayOpen, closePremiumOverlay, gatedStart, startCtaClassName } =
    useGameStartGate('freebie-trash')

  const selectedCategory = useMemo(
    () => getFreebieCategoryById(selectedCategoryId) ?? FREEBIE_CATEGORIES[0],
    [selectedCategoryId],
  )

  const categoryCards = useMemo(
    () => getFreebieCardsByCategory(selectedCategory.id),
    [selectedCategory.id],
  )

  const categoryProgress = useMemo(
    () => getCategoryProgress(progressMap, selectedCategory.id, categoryCards.length),
    [progressMap, selectedCategory.id, categoryCards.length],
  )

  const playedCount = playedInCategory(categoryProgress, categoryCards.length)

  const persistProgress = useCallback((map: CategoryProgressMap) => {
    setProgressMap(map)
    saveCategoryProgressMap(map)
  }, [])

  const handleSelectCategory = (category: FreebieCategory) => {
    hapticSelection()
    setSelectedCategoryId(category.id)
    saveSelectedCategoryId(category.id)
  }

  const startCategory = () => {
    if (categoryCards.length === 0) return

    haptic('medium')
    let progress = getCategoryProgress(progressMap, selectedCategory.id, categoryCards.length)

    if (progress.completed) {
      progress = resetCategoryProgress(selectedCategory.id, categoryCards.length)
      persistProgress({ ...progressMap, [selectedCategory.id]: progress })
    }

    const drawn = drawNextCard(categoryCards, progress)
    if (!drawn) return

    persistProgress({ ...progressMap, [selectedCategory.id]: drawn.progress })
    setCurrentCard(drawn.card)
    setSelectedChoice(null)
    setCategoryComplete(false)
    setScreen('card')
  }

  const handleChoice = (choice: 'take' | 'skip') => {
    hapticSelection()
    setSelectedChoice(choice)
  }

  const handleNextCard = () => {
    if (!currentCard) return
    hapticSelection()

    const progress = getCategoryProgress(progressMap, selectedCategory.id, categoryCards.length)

    if (progress.completed || progress.remainingIndices.length === 0) {
      setCategoryComplete(true)
      setCurrentCard(null)
      setSelectedChoice(null)
      return
    }

    const drawn = drawNextCard(categoryCards, progress)
    if (!drawn) return

    persistProgress({ ...progressMap, [selectedCategory.id]: drawn.progress })
    setCurrentCard(drawn.card)
    setSelectedChoice(null)
    setCategoryComplete(drawn.progress.completed)
  }

  const handleBack = () => {
    if (screen === 'card') {
      setScreen('categories')
      setCurrentCard(null)
      setSelectedChoice(null)
      setCategoryComplete(false)
      return
    }
    handleBackToGames()
  }

  const reactionText = selectedChoice && currentCard
    ? pickReaction(selectedChoice, currentCard.id)
    : null

  return (
    <div className="game-page ft game-page--enter">
      <div className="game-page__top">
        <HomeButton className="game-page__nav-btn" />
        <BackButton onClick={handleBack} className="game-page__nav-btn game-page__back" />
      </div>

      {screen === 'categories' && (
        <div className="ft">
          <GamesPageHeader
            title="Фигня но бесплатно"
            tagline="Берёшь странный подарок судьбы — или нет?"
          />

          <div className="ft__intro game-page__panel game-page__panel--glow-b">
            <h3 className="ft__intro-title">Как играть</h3>
            <p className="ft__intro-text">
              Тебе предлагают странную, смешную или очень сомнительную вещь бесплатно.
              Решай: забираешь или отказываешься. А потом объясняй компании, почему ты
              вообще принял такое решение.
            </p>
          </div>

          <section className="game-page__section">
            <h2 className="game-page__section-title">Категории</h2>
            <div className="ft__categories">
              {FREEBIE_CATEGORIES.map((category) => {
                const totalCards = getFreebieCardCount(category.id)
                const progress = getCategoryProgress(progressMap, category.id, totalCards)
                const played = playedInCategory(progress, totalCards)
                const isSelected = category.id === selectedCategoryId

                return (
                  <button
                    key={category.id}
                    type="button"
                    className={`ft__category-card game-page__panel game-page__panel--glow-a game-page__category-card${isSelected ? ' is-active' : ''}`}
                    onClick={() => handleSelectCategory(category)}
                    aria-pressed={isSelected}
                  >
                    <span className="ft__category-emoji" aria-hidden>{category.emoji}</span>
                    <span className="ft__category-body">
                      <span className="ft__category-title game-page__category-title">{category.title}</span>
                      <span className="ft__category-sub">{category.subtitle}</span>
                      <span className="ft__category-meta">
                        {categoryStatusLabel(played, totalCards, progress.completed)}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          <div className="game-page__actions">
            <button
              type="button"
              className={startCtaClassName}
              disabled={!startLocked && categoryCards.length === 0}
              onClick={() => gatedStart(startCategory)}
            >
              {categoryProgress.completed
                ? 'Пройти категорию заново'
                : playedCount > 0
                  ? `Продолжить · ${playedCount}/${categoryCards.length}`
                  : 'Открыть карточку'}
            </button>
          </div>
        </div>
      )}

      {screen === 'card' && (
        <div className="ft__card-screen">
          <div className="ft__card-head">
            <p className="ft__card-category">{selectedCategory.title}</p>
            {currentCard && !categoryComplete && (
              <p className="game-page__progress ft__card-progress">
                Карточка {playedCount} из {categoryCards.length}
              </p>
            )}
          </div>

          <div className="ft__play-area">
            {categoryComplete && (
              <div className="ft__complete-banner game-page__panel game-page__panel--glow-a" role="status">
                <p className="ft__complete-title">Категория пройдена!</p>
                <p className="ft__complete-text">
                  Все карточки в «{selectedCategory.title}» разобраны. Выбери другую категорию
                  или пройди эту заново.
                </p>
              </div>
            )}

            {currentCard && (
              <article
                key={currentCard.id}
                className="ft__card game-page__panel game-page__panel--glow-b"
              >
                <p className="ft__card-text">{currentCard.text}</p>
                <p className="ft__card-question">{currentCard.question}</p>
              </article>
            )}

            {reactionText && (
              <div className="ft__reaction game-page__panel game-page__panel--glow-a" role="status">
                <p className="ft__reaction-text">{reactionText}</p>
              </div>
            )}

            <div className="ft__actions">
              {currentCard && !selectedChoice && (
                <div className="ft__actions-row">
                  <button
                    type="button"
                    className="game-page__cta"
                    onClick={() => handleChoice('take')}
                  >
                    Беру
                  </button>
                  <button
                    type="button"
                    className="game-page__btn game-page__btn--secondary"
                    onClick={() => handleChoice('skip')}
                  >
                    Не надо
                  </button>
                </div>
              )}

              {currentCard && selectedChoice && (
                <button type="button" className="game-page__cta" onClick={handleNextCard}>
                  Следующая карточка
                </button>
              )}

              {categoryComplete && (
                <button
                  type="button"
                  className="game-page__cta"
                  onClick={() => {
                    setScreen('categories')
                    setCategoryComplete(false)
                  }}
                >
                  К категориям
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <PremiumOverlay isOpen={premiumOverlayOpen} onClose={closePremiumOverlay} />
    </div>
  )
}
