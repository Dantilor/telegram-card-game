import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getDeckFull } from '../data/decks'
import { getDeckFromIndex } from '../data/decksIndex'
import { defaultUserState, type UserState } from '../data/types'
import { useLocalState } from '../hooks/useLocalState'
import { haptic } from '../utils/telegram'
import './Play.css'

type Card = { id: string; text: string }
type TransitionPhase = 'idle' | 'leaving' | 'entering' | 'back'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function getDeckById(deckId: string): { id: string; title: string; questions: string[] } | null {
  const full = getDeckFull(deckId)
  if (!full || !full.questions?.length) return null
  return { id: full.id, title: full.title, questions: full.questions }
}

type GameState =
  | { status: 'loading' }
  | { status: 'ready'; deckId: string; title: string; cards: Card[]; index: number; finished: boolean }
  | { status: 'error'; message: string }
  | { status: 'stub' }

const ANIMATION_NAME_LEAVE = 'cardLeave'
const ANIMATION_NAME_ENTER = 'cardEnter'

export default function Play() {
  const nav = useNavigate()
  const params = useParams<{ deckId?: string }>()
  const [sp] = useSearchParams()

  const deckId = useMemo(
    () => params.deckId ?? sp.get('deckId') ?? sp.get('id') ?? '',
    [params.deckId, sp]
  )

  const [state, setState] = useState<GameState>({ status: 'loading' })
  const [displayIndex, setDisplayIndex] = useState(0)
  const [transitionPhase, setTransitionPhase] = useState<TransitionPhase>('idle')
  const animationPhaseRef = useRef<TransitionPhase>('idle')
  const [localState, setLocalState] = useLocalState<UserState>('tcg_state', defaultUserState)

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })

    const run = () => {
      try {
        if (!deckId) {
          if (!cancelled) setState({ status: 'error', message: 'Колода не выбрана' })
          return
        }
        const deck = getDeckById(deckId)
        const rawCards: Card[] = deck?.questions
          ? deck.questions
              .map((q, idx) => ({ id: String(idx), text: String(q ?? '').trim() }))
              .filter((c) => c.text.length > 0)
          : []

        if (!deck || rawCards.length === 0) {
          if (!cancelled) {
            if (getDeckFromIndex(deckId)) {
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
          Array.isArray(savedOrder) &&
          savedOrder.length === rawCards.length &&
          savedOrder.every((i) => i >= 0 && i < rawCards.length)
        const startIndex =
          hasValidProgress && typeof saved.index === 'number'
            ? Math.min(Math.max(0, saved.index), savedOrder.length - 1)
            : 0

        let prepared: Card[]
        if (hasValidProgress && savedOrder) {
          prepared = savedOrder.map((origIdx) => rawCards[origIdx]).filter(Boolean)
          if (prepared.length !== rawCards.length) prepared = shuffle([...rawCards])
        } else {
          prepared = shuffle([...rawCards])
        }

        if (!cancelled) {
          setState({
            status: 'ready',
            deckId,
            title,
            cards: prepared,
            index: startIndex,
            finished: false,
          })
          setDisplayIndex(startIndex)
          setTransitionPhase('idle')
          animationPhaseRef.current = 'idle'
          if (!hasValidProgress) {
            setLocalState((prev) => ({
              ...prev,
              progress: {
                ...(prev.progress ?? {}),
                [deckId]: { order: prepared.map((c) => Number(c.id)), index: 0 },
              },
            }))
          }
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
  }, [deckId])

  const handleNextClick = () => {
    if (state.status !== 'ready' || transitionPhase !== 'idle') return
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
      nav('/decks')
    }
  }

  const handleAddToFavorites = () => {
    if (state.status !== 'ready' || transitionPhase !== 'idle') return
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
        <div className="play-loading">
          <div className="play-loading__title">Загрузка игры…</div>
          <div className="play-loading__hint">Подготавливаем карточки</div>
        </div>
      </div>
    )
  }

  if (state.status === 'stub') {
    return (
      <div className="play-page">
        <div className="play-error">
          <div className="play-error__title">Колода в разработке / Премиум</div>
          <div className="play-error__msg">Вопросы для этой колоды пока не добавлены.</div>
          <button type="button" className="btn btn--primary play-error__btn" onClick={() => nav(-1)}>
            Назад
          </button>
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="play-page">
        <div className="play-error">
          <div className="play-error__title">Не удалось загрузить игру</div>
          <div className="play-error__msg">{state.message}</div>
          <button type="button" className="btn btn--primary play-error__btn" onClick={() => nav('/decks')}>
            Назад к колодам
          </button>
        </div>
      </div>
    )
  }

  if (state.status === 'ready' && state.finished) {
    return (
      <div className="play-page">
        <div className="play-finish">
          <div className="play-finish__title">Игра окончена</div>
          <div className="play-finish__hint">Можно начать заново или выбрать другую колоду</div>
          <div className="play-finish__actions">
            <button type="button" className="btn btn--primary play-finish__btn" onClick={restart}>
              Начать заново
            </button>
            <button type="button" className="btn btn--ghost play-finish__btn" onClick={() => nav('/decks')}>
              К колодам
            </button>
            <button type="button" className="btn btn--ghost play-finish__btn" onClick={() => nav('/')}>
              Домой
            </button>
          </div>
        </div>
      </div>
    )
  }

  const current = state.status === 'ready' ? state.cards[displayIndex] : null
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
    <div className="play-page play">
      <div className="play-page__top-bar">
        <button
          type="button"
          className="play-page__back-btn btn btn--ghost"
          onClick={handleBackClick}
          disabled={transitionPhase !== 'idle'}
          aria-label="Назад"
        >
          ← Назад
        </button>
        <Link to="/" className="btn btn--ghost play-page__home-btn" onClick={() => haptic('light')}>
          Домой
        </Link>
      </div>

      {state.status === 'ready' && (
        <>
          <h1 className="play-page__title">{state.title}</h1>
          <div className="play-page__progress-wrap">
            <div className="play-page__progress-bar">
              <div
                className="play-page__progress-fill"
                style={{
                  width: `${((displayIndex + 1) / state.cards.length) * 100}%`,
                }}
              />
            </div>
            <p className="play-page__progress-text">
              <span className="font-mono">{displayIndex + 1}</span> / <span className="font-mono">{state.cards.length}</span>
            </p>
          </div>
        </>
      )}

      <div className="play-card-wrap">
        <div
          className={`play-card ${cardPhaseClass}`}
          onAnimationEnd={handleCardAnimationEnd}
        >
          <div className="play-card__text">{current?.text ?? ''}</div>
        </div>
      </div>

      {state.status === 'ready' && (
        <div className="play-page__actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleNextClick}
            disabled={transitionPhase !== 'idle'}
          >
            {isLastCard ? 'Завершить' : 'Следующая'}
          </button>
          <button
            type="button"
            className={`btn btn--ghost ${isInFavorites ? 'btn--fav-active' : ''}`}
            onClick={handleAddToFavorites}
            disabled={isInFavorites || transitionPhase !== 'idle'}
          >
            {isInFavorites ? '⭐ В избранном' : '⭐ В избранное'}
          </button>
          <Link to="/decks" className="btn btn--ghost play-page__back" onClick={() => haptic('light')}>
            Назад к колодам
          </Link>
        </div>
      )}
    </div>
  )
}
