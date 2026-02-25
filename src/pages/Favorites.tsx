import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useLocalState } from '../hooks/useLocalState'
import { useBack } from '../hooks/useBack'
import { usePremium } from '../contexts/PremiumContext'
import { defaultUserState, type UserState } from '../data/types'
import { getDeckFull } from '../data/decks'
import { getDeckFromIndex } from '../data/decksIndex'
import { isFavoritesLocked } from '../utils/access'
import { haptic } from '../utils/telegram'
import HomeButton from '../components/HomeButton'
import PremiumOverlay from '../components/PremiumOverlay'
import './Favorites.css'

type FavoriteItem = {
  deckId: string
  deckTitle: string
  questionIndex: number
  questionText: string
}

function Favorites() {
  const handleBack = useBack('/')
  const [state, setState] = useLocalState<UserState>('tcg_state', defaultUserState)
  const { isPremium } = usePremium()
  const [search, setSearch] = useState('')
  const [premiumOverlayOpen, setPremiumOverlayOpen] = useState(false)

  useEffect(() => {
    if (isFavoritesLocked(isPremium)) {
      setPremiumOverlayOpen(true)
    }
  }, [isPremium])

  const favorites = state.favorites ?? {}
  const deckIds = Object.keys(favorites).filter((id) => {
    const indices = favorites[id]
    return Array.isArray(indices) && indices.length > 0
  })

  const items: FavoriteItem[] = []
  for (const deckId of deckIds) {
    const full = getDeckFull(deckId)
    const indices = favorites[deckId] as number[]
    if (!full?.questions || !indices) continue
    const title = full.title || getDeckFromIndex(deckId)?.title || deckId
    for (const idx of indices) {
      const text = full.questions[idx]
      if (text != null && String(text).trim()) {
        items.push({ deckId, deckTitle: title, questionIndex: idx, questionText: String(text).trim() })
      }
    }
  }

  const searchLower = search.trim().toLowerCase()
  const filtered =
    searchLower === ''
      ? items
      : items.filter((i) => i.questionText.toLowerCase().includes(searchLower))

  const byDeck = filtered.reduce<Record<string, FavoriteItem[]>>((acc, item) => {
    const key = `${item.deckId}|${item.deckTitle}`
    if (!acc[key]) acc[key] = []
    acc[key]!.push(item)
    return acc
  }, {})

  const handleRemove = (deckId: string, questionIndex: number) => {
    haptic('light')
    setState((prev) => {
      const list = (prev.favorites?.[deckId] ?? []).filter((i) => i !== questionIndex)
      const nextFav = { ...prev.favorites }
      if (list.length === 0) {
        delete nextFav[deckId]
      } else {
        nextFav[deckId] = list
      }
      return { ...prev, favorites: nextFav }
    })
  }

  const handleClearAll = () => {
    haptic('medium')
    setState((prev) => ({ ...prev, favorites: {} }))
  }

  return (
    <div className="favorites-page">
      <div className="favorites-page__top">
        <HomeButton />
        <button type="button" className="btn btn--ghost home-btn favorites-page__back" onClick={handleBack}>
          ← Назад
        </button>
      </div>
      <h1 className="favorites-page__title">Моё избранное</h1>

      {items.length === 0 ? (
        <div className="favorites-page__empty card">
          <p className="favorites-page__empty-text">Пока нет избранных вопросов</p>
          <p className="favorites-page__empty-hint">Отмечай ⭐ при игре — они появятся здесь</p>
          <Link to="/games" className="btn btn--primary favorites-page__empty-btn" onClick={() => haptic('light')}>
            Выбрать игру
          </Link>
        </div>
      ) : (
        <>
          <div className="favorites-page__toolbar">
            <input
              type="text"
              className="favorites-page__search card"
              placeholder="Поиск по тексту..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              type="button"
              className="btn btn--ghost favorites-page__clear"
              onClick={handleClearAll}
            >
              Очистить всё
            </button>
          </div>

          <div className="favorites-page__list">
            {Object.entries(byDeck).map(([key, deckItems]) => {
              const first = deckItems[0]!
              return (
                <section key={key} className="favorites-page__deck card">
                  <h2 className="favorites-page__deck-title">
                    <Link to={`/play/${first.deckId}`} onClick={() => haptic('light')}>
                      {first.deckTitle}
                    </Link>
                  </h2>
                  <ul className="favorites-page__items">
                    {deckItems.map((item) => (
                      <li key={`${item.deckId}-${item.questionIndex}`} className="favorites-page__item">
                        <span className="favorites-page__item-text">{item.questionText}</span>
                        <button
                          type="button"
                          className="btn btn--ghost favorites-page__item-remove"
                          onClick={() => handleRemove(item.deckId, item.questionIndex)}
                          aria-label="Удалить из избранного"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>
        </>
      )}
      <PremiumOverlay isOpen={premiumOverlayOpen} onClose={() => setPremiumOverlayOpen(false)} />
    </div>
  )
}

export default Favorites
