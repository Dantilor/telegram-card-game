import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom'
import { getDeckFull } from '../data/decks'
import { getDeckFromIndex, isDeckAdult } from '../data/decksIndex'
import { getDeckQuestions, canOpenDeck } from '../lib/access'
import { defaultUserState, type UserState } from '../data/types'
import { useLocalState } from '../hooks/useLocalState'
import { usePremium } from '../contexts/PremiumContext'
import { isQuestionBeyondFreeLimit, isFavoritesLocked } from '../utils/access'
import type { ModeId } from '../data/modes'
import { haptic } from '../utils/telegram'
import { trackEvent } from '../lib/analytics'
import PremiumOverlay from '../components/PremiumOverlay'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
import AdultConfirmModal from '../components/AdultConfirmModal'
import './Play.css'

type Card = { id: string; text: string }
type TransitionPhase = 'idle' | 'leaving' | 'entering' | 'back'

type PlayNavState = {
  adultConfirmed?: boolean
  fromFavorites?: boolean
  questionIndex?: number
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function getDeckForPlay(
  deckId: string,
  premium: boolean
): { id: string; title: string; questions: string[] } | null {
  const full = getDeckFull(deckId)
  if (!full) return null
  const questions = getDeckQuestions(deckId, { premium })
  if (!questions.length) return null
  return { id: full.id, title: full.title, questions }
}

type GameState =
  | { status: 'loading' }
  | { status: 'ready'; deckId: string; title: string; cards: Card[]; index: number; finished: boolean }
  | { status: 'error'; message: string }
  | { status: 'stub' }
  | { status: 'paywall' }

const ANIMATION_NAME_LEAVE = 'cardLeave'
const ANIMATION_NAME_ENTER = 'cardEnter'

export default function Play() {
  const nav = useNavigate()
  const location = useLocation()
  const params = useParams<{ deckId?: string }>()
  const [sp] = useSearchParams()

  const deckId = useMemo(
    () => params.deckId ?? sp.get('deckId') ?? sp.get('id') ?? '',
    [params.deckId, sp]
  )

  const fromFavorites = useMemo(
    () =>
      (location.state as PlayNavState | null)?.fromFavorites === true ||
      sp.get('from') === 'favorites',
    [location.state, sp]
  )

  const favoriteQuestionIndex = useMemo(() => {
    const navState = location.state as PlayNavState | null
    if (typeof navState?.questionIndex === 'number' && Number.isFinite(navState.questionIndex)) {
      return navState.questionIndex
    }
    const q = sp.get('q')
    if (q == null || q === '') return undefined
    const n = Number(q)
    return Number.isFinite(n) ? n : undefined
  }, [location.state, sp])

  const navigateLeavePlay = () => {
    if (fromFavorites) {
      nav('/favorites')
      return
    }
    if (window.history.length > 1) nav(-1)
    else nav('/games')
  }

  const navigateTopBarBack = () => {
    if (fromFavorites) {
      nav('/favorites')
      return
    }
    const entry = getDeckFromIndex(deckId)
    nav(`/mode/${entry?.modeId ?? 'party'}`)
  }

  const [state, setState] = useState<GameState>({ status: 'loading' })
  const [displayIndex, setDisplayIndex] = useState(0)
  const [transitionPhase, setTransitionPhase] = useState<TransitionPhase>('idle')
  const animationPhaseRef = useRef<TransitionPhase>('idle')
  const [localState, setLocalState] = useLocalState<UserState>('tcg_state', defaultUserState)
  const { isPremium } = usePremium()
  const [premiumOverlayOpen, setPremiumOverlayOpen] = useState(false)
  const [adultGatePassed, setAdultGatePassed] = useState(() =>
    (location.state as PlayNavState | null)?.adultConfirmed === true
  )

  const needsAdultConfirm = deckId && isDeckAdult(deckId) && !adultGatePassed

  useEffect(() => {
    const fromConfirm = (location.state as PlayNavState | null)?.adultConfirmed
    setAdultGatePassed(fromConfirm === true)
  }, [deckId, location.state])

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })

    const run = () => {
      try {
        if (!deckId) {
          if (!cancelled) setState({ status: 'error', message: 'Колода не выбрана' })
          return
        }
        const deckEntry = getDeckFromIndex(deckId)
        if (deckEntry && !canOpenDeck(deckEntry, isPremium)) {
          if (!cancelled) setState({ status: 'paywall' })
          return
        }
        const deck = getDeckForPlay(deckId, isPremium)
        const rawCards: Card[] = deck?.questions
          ? deck.questions
              .map((q, idx) => ({ id: String(idx), text: String(q ?? '').trim() }))
              .filter((c) => c.text.length > 0)
          : []

        if (!deck || rawCards.length === 0) {
          if (!cancelled) {
            if (deckEntry && !canOpenDeck(deckEntry, isPremium)) {
              setState({ status: 'paywall' })
            } else if (getDeckFromIndex(deckId)) {
              setState({ status: 'stub' })
            } else {
              setState({ status: 'error', message: 'Колода не найдена или пуста' })
            }
          }
          return
        }

        const title = deck.title || 'Игра'
        const saved = localState.progress?.[deckId]
        const savedOrder = saved?.order
        const hasValidProgress =
          !fromFavorites &&
          Array.isArray(savedOrder) &&
          savedOrder.length === rawCards.length &&
          savedOrder.every((i) => i >= 0 && i < rawCards.length)

        let prepared: Card[]
        let startIndex: number

        if (fromFavorites && favoriteQuestionIndex !== undefined) {
          prepared = [...rawCards]
          const pos = prepared.findIndex((c) => Number(c.id) === favoriteQuestionIndex)
          startIndex = pos >= 0 ? pos : 0
        } else if (hasValidProgress && savedOrder) {
          prepared = savedOrder.map((origIdx) => rawCards[origIdx]).filter(Boolean)
          if (prepared.length !== rawCards.length) prepared = shuffle([...rawCards])
          startIndex =
            typeof saved.index === 'number'
              ? Math.min(Math.max(0, saved.index), prepared.length - 1)
              : 0
        } else {
          prepared = shuffle([...rawCards])
          startIndex = 0
        }

        const resolvedStartIndex = Math.min(Math.max(0, startIndex), prepared.length - 1)

        if (!cancelled) {
          trackEvent('open_deck', { deckId })
          trackEvent('start_game', { gameId: 'card' })
          setState({
            status: 'ready',
            deckId,
            title,
            cards: prepared,
            index: resolvedStartIndex,
            finished: false,
          })
          setDisplayIndex(resolvedStartIndex)
          setTransitionPhase('idle')
          animationPhaseRef.current = 'idle'
          setLocalState((prev) => ({
            ...prev,
            progress: {
              ...(prev.progress ?? {}),
              [deckId]: {
                order: prepared.map((c) => Number(c.id)),
                index: resolvedStartIndex,
              },
            },
          }))
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setState({ status: 'error', message: e instanceof Error ? e.message : 'Ошибка загрузки' })
        }
      }
    }

    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(run, { timeout: 300 })
      return () => {
        cancelled = true
        w.cancelIdleCallback?.(id)
      }
    }
    const id = window.setTimeout(run, 0)
    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [deckId, isPremium, fromFavorites, favoriteQuestionIndex])

  const handleAdultConfirm = () => {
    setAdultGatePassed(true)
  }

  const handleAdultCancel = () => {
    navigateLeavePlay()
  }

  const handleNextClick = () => {
    if (state.status !== 'ready' || transitionPhase !== 'idle') return
    const nextIndex = state.index + 1
    const indexEntry = getDeckFromIndex(state.deckId)
    const modeId = (indexEntry?.modeId ?? 'party') as ModeId
    if (isQuestionBeyondFreeLimit(modeId, state.deckId, nextIndex, isPremium)) {
      haptic('light')
      setPremiumOverlayOpen(true)
      return
    }
    const last = state.index >= state.cards.length - 1
    if (last) {
      setTransitionPhase('leaving')
      animationPhaseRef.current = 'leaving'
    } else {
      setTransitionPhase('leaving')
      animationPhaseRef.current = 'leaving'
    }
  }

  const handleCardAnimationEnd = (e: React.AnimationEvent<HTMLDivElement>) => {
    const name = e.animationName
    const phase = animationPhaseRef.current

    if (name === ANIMATION_NAME_LEAVE && phase === 'leaving') {
      const isLast = state.status === 'ready' && state.index >= state.cards.length - 1
      if (isLast) {
        setState((s) => (s.status === 'ready' ? { ...s, finished: true } : s))
        setTransitionPhase('idle')
        animationPhaseRef.current = 'idle'
      } else {
        const nextIdx = state.status === 'ready' ? state.index + 1 : 0
        setState((s) => (s.status === 'ready' ? { ...s, index: s.index + 1 } : s))
        setDisplayIndex(nextIdx)
        setTransitionPhase('entering')
        animationPhaseRef.current = 'entering'
        if (state.status === 'ready') {
          setLocalState((prev) => ({
            ...prev,
            progress: {
              ...(prev.progress ?? {}),
              [state.deckId]: {
                order: state.cards.map((c) => Number(c.id)),
                index: nextIdx,
              },
            },
          }))
        }
      }
    } else if (name === ANIMATION_NAME_ENTER && phase === 'entering') {
      setTransitionPhase('idle')
      animationPhaseRef.current = 'idle'
    }
  }

  const handleBackClick = () => {
    if (state.status !== 'ready' || transitionPhase !== 'idle') return
    haptic('light')
    if (state.index > 0) {
      const prevIndex = state.index - 1
      setState((s) => (s.status === 'ready' ? { ...s, index: prevIndex } : s))
      setDisplayIndex(prevIndex)
      setTransitionPhase('back')
      setLocalState((prev) => ({
        ...prev,
        progress: {
          ...(prev.progress ?? {}),
          [state.deckId]: {
            order: state.cards.map((c) => Number(c.id)),
            index: prevIndex,
          },
        },
      }))
      window.setTimeout(() => {
        setTransitionPhase('idle')
        animationPhaseRef.current = 'idle'
      }, 200)
    } else {
      navigateLeavePlay()
    }
  }

  const handleTopBarBack = () => {
    if (transitionPhase !== 'idle') return
    haptic('light')
    navigateTopBarBack()
  }

  const handleAddToFavorites = () => {
    if (state.status !== 'ready' || transitionPhase !== 'idle') return
    if (isFavoritesLocked(isPremium)) {
      haptic('light')
      setPremiumOverlayOpen(true)
      return
    }
    haptic('light')
    const current = state.cards[displayIndex]
    if (!current) return
    const cardIndex = Number(current.id)
    if (Number.isNaN(cardIndex)) return
    setLocalState((prev) => {
      const list = prev.favorites?.[state.deckId] ?? []
      if (list.includes(cardIndex)) return prev
      return {
        ...prev,
        favorites: {
          ...(prev.favorites ?? {}),
          [state.deckId]: [...list, cardIndex],
        },
      }
    })
  }

  const restart = () => {
    setState((s) => {
      if (s.status !== 'ready') return s
      const shuffled = shuffle([...s.cards])
      setLocalState((prev) => ({
        ...prev,
        progress: {
          ...(prev.progress ?? {}),
          [s.deckId]: { order: shuffled.map((c) => Number(c.id)), index: 0 },
        },
      }))
      return { ...s, cards: shuffled, index: 0, finished: false }
    })
    setDisplayIndex(0)
    setTransitionPhase('idle')
    animationPhaseRef.current = 'idle'
  }

  if (state.status === 'loading') {
    return (
      <div className="play-page">
        <div className="play-page__state">
          <div className="play-page__loader" aria-hidden />
          <p className="play-page__state-title">Загрузка игры…</p>
          <p className="play-page__state-hint">Подготавливаем карточки</p>
        </div>
        {needsAdultConfirm && (
          <AdultConfirmModal
            isOpen
            onConfirm={handleAdultConfirm}
            onCancel={handleAdultCancel}
          />
        )}
      </div>
    )
  }

  if (state.status === 'stub') {
    return (
      <div className="play-page">
        <div className="play-page__state">
          <p className="play-page__state-title">Колода в разработке</p>
          <p className="play-page__state-hint">Вопросы для этой колоды пока не добавлены.</p>
          <button
            type="button"
            className="play-page__cta"
            onClick={() => {
              haptic('light')
              navigateLeavePlay()
            }}
          >
            Назад
          </button>
        </div>
      </div>
    )
  }

  if (state.status === 'paywall') {
    return (
      <div className="play-page">
        <div className="play-page__state">
          <BackButton onClick={navigateLeavePlay} className="play-page__nav-btn play-page__state-back" />
          <PremiumOverlay isOpen onClose={navigateLeavePlay} />
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="play-page">
        <div className="play-page__state">
          <p className="play-page__state-title">Не удалось загрузить игру</p>
          <p className="play-page__state-hint">{state.message}</p>
          <button
            type="button"
            className="play-page__cta"
            onClick={() => {
              haptic('light')
              navigateLeavePlay()
            }}
          >
            Назад
          </button>
        </div>
      </div>
    )
  }

  if (state.status === 'ready' && state.finished) {
    return (
      <div className="play-page">
        <div className="play-page__state play-page__state--finish">
          <span className="play-page__state-icon" aria-hidden>✦</span>
          <h2 className="play-page__state-title">Игра окончена</h2>
          <p className="play-page__state-hint">Можно начать заново или выбрать другую колоду</p>
          <div className="play-page__state-actions">
            <button type="button" className="play-page__cta" onClick={restart}>
              Начать заново
            </button>
            <button
              type="button"
              className="play-page__fav-btn"
              onClick={() => {
                haptic('light')
                navigateTopBarBack()
              }}
            >
              К колодам
            </button>
            <button type="button" className="play-page__prev-btn" onClick={() => nav('/')}>
              На главную
            </button>
          </div>
        </div>
      </div>
    )
  }

  const current = state.status === 'ready' ? state.cards[displayIndex] : null
  const deckFull = state.status === 'ready' ? getDeckFull(state.deckId) : null
  const cardPrompt = deckFull?.cardPrompt
  const cardPhaseClass =
    transitionPhase === 'leaving'
      ? 'play-card--leave'
      : transitionPhase === 'entering'
        ? 'play-card--enter'
        : transitionPhase === 'back'
          ? 'play-card--back'
          : 'play-card--idle'
  const isLastCard = state.status === 'ready' && state.index >= state.cards.length - 1
  const deckFavorites: number[] =
    state.status === 'ready' ? localState.favorites?.[state.deckId] ?? [] : []
  const currentCardIndex = current ? Number(current.id) : -1
  const isInFavorites = Number.isInteger(currentCardIndex) && deckFavorites.includes(currentCardIndex)

  return (
    <div className="play-page">
      <div className="play-page__top">
        <HomeButton className="play-page__nav-btn" />
        <BackButton
          onClick={handleTopBarBack}
          className="play-page__nav-btn play-page__back-nav"
        />
      </div>

      {state.status === 'ready' && (
        <header className="play-page__header">
          <h1 className="play-page__title">{state.title}</h1>
          <div className="play-page__progress-wrap">
            <div className="play-page__progress-bar" aria-hidden>
              <div
                className="play-page__progress-fill"
                style={{ width: `${((displayIndex + 1) / state.cards.length) * 100}%` }}
              />
            </div>
            <p className="play-page__progress-text">
              <span className="play-page__progress-current">{displayIndex + 1}</span>
              <span className="play-page__progress-sep">/</span>
              <span className="play-page__progress-total">{state.cards.length}</span>
            </p>
          </div>
        </header>
      )}

      <div className="play-card-wrap">
        <div
          className={`play-card ${cardPhaseClass}`}
          onAnimationEnd={handleCardAnimationEnd}
        >
          <div className="play-card__inner">
            {cardPrompt && <p className="play-card__prompt">{cardPrompt}</p>}
            <p className="play-card__text">{current?.text ?? ''}</p>
          </div>
        </div>
      </div>

      {state.status === 'ready' && (
        <div className="play-page__actions">
          <button
            type="button"
            className="play-page__cta"
            onClick={handleNextClick}
            disabled={transitionPhase !== 'idle'}
          >
            {isLastCard ? 'Завершить ✦' : 'Следующая →'}
          </button>
          <button
            type="button"
            className={`play-page__fav-btn${isInFavorites ? ' play-page__fav-btn--active' : ''}`}
            onClick={handleAddToFavorites}
            disabled={isInFavorites || transitionPhase !== 'idle'}
          >
            {isInFavorites ? '⭐ В избранном' : '⭐ В избранное'}
          </button>
          <button
            type="button"
            className="play-page__prev-btn"
            onClick={handleBackClick}
            disabled={transitionPhase !== 'idle'}
          >
            ← Предыдущий вопрос
          </button>
        </div>
      )}
      <PremiumOverlay isOpen={premiumOverlayOpen} onClose={() => setPremiumOverlayOpen(false)} />
      {needsAdultConfirm && (
        <AdultConfirmModal
          isOpen
          onConfirm={handleAdultConfirm}
          onCancel={handleAdultCancel}
        />
      )}
    </div>
  )
}
