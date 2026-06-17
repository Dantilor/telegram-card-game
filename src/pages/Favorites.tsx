import { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useLocalState } from '../hooks/useLocalState'
import { useBack } from '../hooks/useBack'
import { useTheme } from '../hooks/useTheme'
import { usePremium } from '../contexts/PremiumContext'
import { isFavoritesLocked } from '../utils/access'
import { defaultUserState, type UserState } from '../data/types'
import { getDeckFull } from '../data/decks'
import { getDeckFromIndex } from '../data/decksIndex'
import { MODES, type ModeId } from '../data/modes'
import { haptic } from '../utils/telegram'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
import SmartImage from '../components/SmartImage'
import iconFavoriteStar from '../assets/icons/gnh/action-favorite-star.svg'
import iconLightFavorite from '../assets/icons/gnh-light-pro/light-favorite-star-pro.svg'
import iconSunsetFavorite from '../assets/icons/gnh-sunset-pro/sunset-favorite-star-pro.svg'
import iconCalmFavorite from '../assets/icons/gnh-calm-pro/calm-favorite-star-pro.svg'
import iconChevronRight from '../assets/icons/gnh/chevron-right.svg'
import iconLightChevron from '../assets/icons/gnh-light-pro/light-chevron-right-pro.svg'
import iconSunsetChevron from '../assets/icons/gnh-sunset-pro/sunset-chevron-right-pro.svg'
import iconCalmChevron from '../assets/icons/gnh-calm-pro/calm-chevron-right-pro.svg'
import PremiumOverlay from '../components/PremiumOverlay'
import './Favorites.css'

const STAR_BY_THEME = {
  'neon-dark': iconFavoriteStar,
  'neon-light': iconLightFavorite,
  sunset: iconSunsetFavorite,
  'minimal-calm': iconCalmFavorite,
} as const

const CHEVRON_BY_THEME = {
  'neon-dark': iconChevronRight,
  'neon-light': iconLightChevron,
  sunset: iconSunsetChevron,
  'minimal-calm': iconCalmChevron,
} as const

const DECK_BADGE: Partial<Record<string, { label: string; emoji: string }>> = {
  aboutUs: { label: 'Для пар', emoji: '💞' },
  feelings: { label: 'Настроение', emoji: '😊' },
}

const MODE_BADGE: Record<ModeId, { label: string; emoji: string }> = {
  couples: { label: 'Для пар', emoji: '💞' },
  dates: { label: 'Свидания', emoji: '💕' },
  party: { label: 'Компания', emoji: '👥' },
  adult: { label: '18+', emoji: '🔥' },
  psychology: { label: 'Настроение', emoji: '🧠' },
  lifeChoice: { label: 'Жизнь', emoji: '🎯' },
}

type FavoriteItem = {
  deckId: string
  deckTitle: string
  modeId: ModeId
  modeImage?: string
  questionIndex: number
  questionText: string
  badge: { label: string; emoji: string }
}

function getDeckBadge(deckId: string, modeId: ModeId) {
  return DECK_BADGE[deckId] ?? MODE_BADGE[modeId]
}

function Favorites() {
  const handleBack = useBack('/')
  const [theme] = useTheme()
  const { isPremium } = usePremium()
  const favoritesLocked = isFavoritesLocked(isPremium)
  const [premiumOverlayOpen, setPremiumOverlayOpen] = useState(false)
  const [state, setState] = useLocalState<UserState>('tcg_state', defaultUserState)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (favoritesLocked) setPremiumOverlayOpen(true)
  }, [favoritesLocked])

  const starIcon = STAR_BY_THEME[theme]
  const chevronIcon = CHEVRON_BY_THEME[theme]

  const items = useMemo(() => {
    const favorites = state.favorites ?? {}
    const deckIds = Object.keys(favorites).filter((id) => {
      const indices = favorites[id]
      return Array.isArray(indices) && indices.length > 0
    })

    const result: FavoriteItem[] = []
    for (const deckId of deckIds) {
      const full = getDeckFull(deckId)
      const indexEntry = getDeckFromIndex(deckId)
      const indices = favorites[deckId] as number[]
      if (!full?.questions || !indices) continue

      const modeId = (indexEntry?.modeId ?? 'party') as ModeId
      const mode = MODES.find((m) => m.id === modeId)
      const title = full.title || indexEntry?.title || deckId

      for (const idx of indices) {
        const text = full.questions[idx]
        if (text != null && String(text).trim()) {
          result.push({
            deckId,
            deckTitle: title,
            modeId,
            modeImage: mode?.image,
            questionIndex: idx,
            questionText: String(text).trim(),
            badge: getDeckBadge(deckId, modeId),
          })
        }
      }
    }
    return result
  }, [state.favorites])

  const searchLower = search.trim().toLowerCase()
  const filtered =
    searchLower === ''
      ? items
      : items.filter(
          (item) =>
            item.questionText.toLowerCase().includes(searchLower) ||
            item.deckTitle.toLowerCase().includes(searchLower) ||
            item.badge.label.toLowerCase().includes(searchLower)
        )

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

  return (
    <div className="favorites-page">
      <div className="favorites-page__top">
        <HomeButton className="favorites-page__nav-btn" />
        <BackButton onClick={handleBack} className="favorites-page__nav-btn favorites-page__back" />
      </div>

      <header className="favorites-page__header">
        <h1 className="favorites-page__title">Моё избранное</h1>
        {items.length > 0 && (
          <p className="favorites-page__counter">
            <img src={starIcon} alt="" className="favorites-page__counter-icon" decoding="async" aria-hidden />
            <span>Сохранено: {items.length}</span>
          </p>
        )}
      </header>

      {items.length === 0 ? (
        <div className="favorites-page__empty">
          <span className="favorites-page__empty-star" aria-hidden>
            <img src={starIcon} alt="" decoding="async" />
          </span>
          <p className="favorites-page__empty-text">Пока нет избранных вопросов</p>
          <p className="favorites-page__empty-hint">Отмечай ⭐ при игре — они появятся здесь</p>
        </div>
      ) : (
        <>
          <label className="favorites-page__search-wrap">
            <span className="favorites-page__search-icon" aria-hidden>⌕</span>
            <input
              type="search"
              className="favorites-page__search"
              placeholder="Поиск по вопросам..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              enterKeyHint="search"
            />
          </label>

          {filtered.length === 0 ? (
            <p className="favorites-page__no-results">Ничего не найдено</p>
          ) : (
            <ul className="favorites-page__list">
              {filtered.map((item) => (
                <li key={`${item.deckId}-${item.questionIndex}`}>
                  <article className="favorites-page__card">
                    <Link
                      to={`/play/${item.deckId}?from=favorites&q=${item.questionIndex}`}
                      state={{ fromFavorites: true, questionIndex: item.questionIndex }}
                      className="favorites-page__card-link"
                      onClick={() => haptic('light')}
                    >
                      <span className="favorites-page__thumb-wrap" aria-hidden>
                        {item.modeImage ? (
                          <SmartImage
                            src={item.modeImage}
                            alt=""
                            className="favorites-page__thumb"
                            objectFit="cover"
                            aspectRatio="1 / 1"
                          />
                        ) : (
                          <span className="favorites-page__thumb-fallback">{item.badge.emoji}</span>
                        )}
                      </span>
                      <span className="favorites-page__body">
                        <span className="favorites-page__card-title">{item.deckTitle}</span>
                        <span className="favorites-page__tag">
                          <span className="favorites-page__tag-emoji" aria-hidden>{item.badge.emoji}</span>
                          {item.badge.label}
                        </span>
                        <span className="favorites-page__desc">{item.questionText}</span>
                      </span>
                      <img
                        src={chevronIcon}
                        alt=""
                        className="favorites-page__chev"
                        decoding="async"
                        aria-hidden
                      />
                    </Link>
                    <button
                      type="button"
                      className="favorites-page__star-btn"
                      onClick={() => handleRemove(item.deckId, item.questionIndex)}
                      aria-label="Удалить из избранного"
                    >
                      <img src={starIcon} alt="" className="favorites-page__star-icon" decoding="async" />
                    </button>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <PremiumOverlay isOpen={premiumOverlayOpen} onClose={() => setPremiumOverlayOpen(false)} />
    </div>
  )
}

export default Favorites
