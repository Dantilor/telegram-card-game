import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { getDeckFull } from '../data/decks'
import { defaultUserState, type UserState, type DeckFull } from '../data/types'
import { useLocalState } from '../hooks/useLocalState'
import { useSwipeCard } from '../hooks/useSwipeCard'
import { createInvoice, openInvoice } from '../api/subscription'
import { getTg, getInitData, haptic } from '../utils/telegram'
import { timeStart, timeEnd } from '../utils/perf'
import MicroConfetti from '../components/MicroConfetti'
import HomeButton from '../components/HomeButton'
import './Play.css'

const LOAD_TIMEOUT_MS = 2500
const END_SCREEN_TIMEOUT_MS = 2000
const LOAD_ERROR_MSG = 'Не удалось загрузить игру с первого раза. Нажмите «Повторить».'

type Phase = 'boot' | 'loading' | 'ready' | 'finishing' | 'done' | 'error'

function shuffleFisherYates<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function prepareDeck(deckFull: DeckFull): { order: number[]; index: number } {
  const n = deckFull.questions.length
  const order = shuffleFisherYates(Array.from({ length: n }, (_, i) => i))
  return { order, index: 0 }
}

const nextFrame = (): Promise<void> =>
  new Promise((r) => {
    requestAnimationFrame(() => r())
  })

function Play() {
  const params = useParams<{ deckId?: string }>()
  const [searchParams] = useSearchParams()
  const deckId = params.deckId ?? ''
  const deckFull = useMemo(() => (deckId ? getDeckFull(deckId) : null), [deckId])
  const deck = deckFull
    ? {
        id: deckFull.id,
        title: deckFull.title,
        description: deckFull.description,
        isPremium: deckFull.isPremium,
        questionsCount: deckFull.questionsCount,
      }
    : undefined

  const [phase, setPhase] = useState<Phase>('boot')
  const [errorText, setErrorText] = useState<string | null>(null)
  const [initAttempt, setInitAttempt] = useState(0)
  const startedAtRef = useRef<number>(0)
  const [showFavoritesView, setShowFavoritesView] = useState(false)
  const [invoiceLoading, setInvoiceLoading] = useState<'month' | 'year' | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [isExiting, setIsExiting] = useState(false)
  const [isEntering, setIsEntering] = useState(false)
  const [endScreenReady, setEndScreenReady] = useState(false)
  const [endScreenError, setEndScreenError] = useState(false)
  const [debugOverlayHidden, setDebugOverlayHidden] = useState(false)
  const navigate = useNavigate()
  const swipeWrapRef = useRef<HTMLDivElement>(null)

  const [state, setState] = useLocalState<UserState>('tcg_state', defaultUserState)
  const progress: { order: number[]; index: number } | undefined = deckId ? state.progress?.[deckId] : undefined
  const N = deckFull?.questions.length ?? 0
  const isEnd = !!progress && N > 0 && progress.index >= N
  const isDebug = searchParams.get('debug') === '1'

  useEffect(() => {
    const onPremiumUpdated = () => {
      try {
        const raw = localStorage.getItem('tcg_state')
        if (raw) setState(JSON.parse(raw) as UserState)
      } catch {
        // ignore
      }
    }
    window.addEventListener('tcg_premium_updated', onPremiumUpdated)
    return () => window.removeEventListener('tcg_premium_updated', onPremiumUpdated)
  }, [setState])

  useEffect(() => {
    const tg = getTg()
    const handler = () => navigate('/decks')
    tg?.BackButton?.show?.()
    tg?.BackButton?.onClick?.(handler)
    return () => {
      tg?.BackButton?.hide?.()
    }
  }, [navigate])

  useEffect(() => {
    if (isEnd && !showFavoritesView && deck) {
      setShowConfetti(true)
      const t = setTimeout(() => setShowConfetti(false), 2100)
      return () => clearTimeout(t)
    } else {
      setShowConfetti(false)
    }
  }, [isEnd, showFavoritesView, deck])

  const endScreenReadyRef = useRef(false)
  useEffect(() => {
    if (!isEnd) {
      setEndScreenReady(false)
      setEndScreenError(false)
      endScreenReadyRef.current = false
      return
    }
    endScreenReadyRef.current = false
    let cancelled = false
    timeStart('play-end-screen')
    const t = setTimeout(() => {
      if (cancelled) return
      try {
        endScreenReadyRef.current = true
        setEndScreenReady(true)
        setEndScreenError(false)
      } catch {
        setEndScreenError(true)
      }
      timeEnd('play-end-screen')
    }, 120)
    const guard = setTimeout(() => {
      if (cancelled) return
      if (!endScreenReadyRef.current) setEndScreenError(true)
    }, END_SCREEN_TIMEOUT_MS)
    return () => {
      cancelled = true
      clearTimeout(t)
      clearTimeout(guard)
    }
  }, [isEnd])

  useEffect(() => {
    if (!deckId || !deckFull) return
    let cancelled = false
    startedAtRef.current = Date.now()
    setPhase('loading')
    setErrorText(null)

    const run = async () => {
      try {
        await nextFrame()
        if (cancelled) return
        timeStart('play-deck-prep')
        const progressData = prepareDeck(deckFull)
        if (cancelled) return
        setState((prev) => ({
          ...prev,
          progress: { ...(prev.progress ?? {}), [deckId]: progressData },
        }))
        timeEnd('play-deck-prep')
        if (!cancelled) setPhase('ready')
      } catch (e) {
        if (cancelled) return
        setPhase('error')
        setErrorText(e instanceof Error ? e.message : 'Ошибка инициализации')
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [deckId, deckFull, initAttempt, setState])

  useEffect(() => {
    if (phase !== 'loading') return
    const t = setTimeout(() => {
      setPhase((p) => {
        if (p !== 'loading') return p
        setErrorText(LOAD_ERROR_MSG)
        return 'error'
      })
    }, LOAD_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [phase, initAttempt])

  const handleRetry = useCallback(() => {
    haptic('light')
    setErrorText(null)
    setInitAttempt((a) => a + 1)
  }, [])

  if (!deckId) {
    return (
      <div className="play-page">
        <div className="play-page__top-bar">
          <HomeButton />
        </div>
        <p className="play-page__message">Колода не выбрана</p>
        <div className="play-page__actions">
          <button type="button" className="btn btn--primary" onClick={() => { haptic('light'); navigate('/'); }}>
            Домой
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => { haptic('light'); navigate(-1); }}>
            Назад
          </button>
        </div>
      </div>
    )
  }

  if (!deck) {
    return (
      <div className="play-page">
        <div className="play-page__top-bar">
          <HomeButton />
          <Link to="/decks" className="btn btn--ghost play-page__back" onClick={() => haptic('light')}>
            Назад
          </Link>
        </div>
        <p className="play-page__message">Колода не найдена</p>
      </div>
    )
  }

  if (!deckFull) {
    return (
      <div className="play-page">
        <div className="play-page__top-bar">
          <HomeButton />
        </div>
        <p className="play-page__message">Подготовка колоды...</p>
      </div>
    )
  }

  const isPremiumRequired = deck.isPremium && !state.premium
  const init = getInitData()
  const inTelegram = init.source !== 'none' && !!init.initDataRaw
  if (isPremiumRequired) {
    const handleBuy = (plan: 'month' | 'year') => {
      haptic('light')
      if (!inTelegram) return
      setInvoiceLoading(plan)
      createInvoice(plan)
        .then(({ invoiceLink }) => openInvoice(invoiceLink))
        .catch(() => {})
        .finally(() => setInvoiceLoading(null))
    }
    return (
      <div className="play-page">
        <div className="play-page__top-bar">
          <HomeButton />
        </div>
        <h1 className="play-page__title">{deck.title}</h1>
        <p className="play-page__message">Premium колода</p>
        {inTelegram ? (
          <>
            <div className="play-page__paywall-panel card">
              <h2 className="play-page__paywall-title">Premium доступ</h2>
              <ul className="play-page__paywall-list">
                <li>Доступ ко всем колодам без ограничений</li>
                <li>Эксклюзивные темы: вечеринка, интимность</li>
                <li>Без рекламы и отвлекающих элементов</li>
                <li>Поддержка развития приложения</li>
              </ul>
              <div className="play-page__paywall-buttons">
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={invoiceLoading !== null}
                  onClick={() => handleBuy('month')}
                >
                  {invoiceLoading === 'month' ? 'Загрузка…' : '299 ₽/мес'}
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={invoiceLoading !== null}
                  onClick={() => handleBuy('year')}
                >
                  {invoiceLoading === 'year' ? 'Загрузка…' : '1990 ₽/год'}
                </button>
                <button type="button" className="btn btn--secondary" disabled>
                  Восстановить покупку
                </button>
              </div>
              <p className="play-page__paywall-note">
                Оплата через Telegram Stars. Отменить подписку можно в настройках.
              </p>
            </div>
            <Link to="/decks" className="btn btn--ghost play-page__back" onClick={() => haptic('light')}>
              Назад к колодам
            </Link>
          </>
        ) : (
          <>
            <div className="play-page__browser-only">
              Оплата доступна только в Telegram. Откройте Mini App через бота, чтобы оформить Premium.
            </div>
            <div className="play-page__paywall-buttons">
              <button type="button" className="btn btn--primary" disabled>
                299 ₽/мес
              </button>
              <button type="button" className="btn btn--primary" disabled>
                1990 ₽/год
              </button>
            </div>
            <Link to="/decks" className="btn btn--ghost play-page__back" onClick={() => haptic('light')}>
              Назад к колодам
            </Link>
          </>
        )}
      </div>
    )
  }

  if (phase === 'boot' || phase === 'loading') {
    return (
      <div className="play-page">
        {isDebug && !debugOverlayHidden && (
          <div
            className="play-page__debug"
            role="button"
            tabIndex={0}
            onClick={() => setDebugOverlayHidden(true)}
            onKeyDown={(e) => e.key === 'Enter' && setDebugOverlayHidden(true)}
            title="Скрыть"
          >
            phase={phase} attempt={initAttempt} ×
          </div>
        )}
        <div className="play-page__top-bar">
          <HomeButton />
        </div>
        <p className="play-page__message">Загрузка…</p>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="play-page">
        {isDebug && !debugOverlayHidden && (
          <div
            className="play-page__debug"
            role="button"
            tabIndex={0}
            onClick={() => setDebugOverlayHidden(true)}
            onKeyDown={(e) => e.key === 'Enter' && setDebugOverlayHidden(true)}
            title="Скрыть"
          >
            phase={phase} attempt={initAttempt} err={errorText ?? ''} ×
          </div>
        )}
        <div className="play-page__top-bar">
          <HomeButton />
        </div>
        <p className="play-page__message">{errorText ?? LOAD_ERROR_MSG}</p>
        <div className="play-page__actions">
          <button type="button" className="btn btn--primary" onClick={handleRetry}>
            Повторить
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              haptic('light')
              navigate('/')
            }}
          >
            Домой
          </button>
        </div>
      </div>
    )
  }

  if (phase !== 'ready' || !progress) {
    return (
      <div className="play-page">
        <div className="play-page__top-bar">
          <HomeButton />
        </div>
        <p className="play-page__message">Загрузка…</p>
      </div>
    )
  }

  const { order, index } = progress
  const questionIndex = order[index]
  const currentQuestion = deckFull.questions[questionIndex]
  const deckFavorites: number[] = state.favorites?.[deckId] ?? []
  const isCurrentInFavorites = deckFavorites.includes(questionIndex)

  const handleNext = () => {
    if (index >= N) return
    setState((prev) => ({
      ...prev,
      progress: {
        ...(prev.progress ?? {}),
        [deckId]: { order, index: index + 1 },
      },
    }))
  }

  const handleNextWithAnimation = () => {
    haptic('light')
    if (index >= N) return
    setIsExiting(true)
    setTimeout(() => {
      handleNext()
      setIsExiting(false)
      setIsEntering(true)
      setTimeout(() => setIsEntering(false), 160)
    }, 120)
  }

  const handleSwipeRight = () => {
    if (index >= N) return
    handleNext()
    setIsEntering(true)
    setTimeout(() => setIsEntering(false), 160)
  }

  const handleAddToFavorites = () => {
    haptic('light')
    if (isCurrentInFavorites) return
    setState((prev) => ({
      ...prev,
      favorites: {
        ...(prev.favorites ?? {}),
        [deckId]: [...(prev.favorites?.[deckId] ?? []), questionIndex],
      },
    }))
  }

  const handleRestart = () => {
    const newProgress = prepareDeck(deckFull)
    setState((prev) => ({
      ...prev,
      progress: { ...(prev.progress ?? {}), [deckId]: newProgress },
    }))
  }

  const favoriteQuestions = useMemo(
    () => deckFavorites.map((i: number) => deckFull.questions[i]),
    [deckFavorites, deckFull.questions]
  )

  if (isEnd) {
    if (endScreenError) {
      return (
        <div className="play-page">
          {isDebug && !debugOverlayHidden && (
            <div
              className="play-page__debug"
              role="button"
              tabIndex={0}
              onClick={() => setDebugOverlayHidden(true)}
              onKeyDown={(e) => e.key === 'Enter' && setDebugOverlayHidden(true)}
              title="Скрыть"
            >
              phase=finishing err ×
            </div>
          )}
          <div className="play-page__top-bar">
            <HomeButton />
          </div>
          <p className="play-page__message">Не удалось показать итоги.</p>
          <div className="play-page__actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                haptic('light')
                setEndScreenError(false)
                setEndScreenReady(true)
              }}
            >
              Повторить
            </button>
            <Link to="/decks" className="btn btn--ghost play-page__back" onClick={() => haptic('light')}>
              Назад к колодам
            </Link>
          </div>
        </div>
      )
    }
    if (!endScreenReady) {
      return (
        <div className="play-page">
          {isDebug && !debugOverlayHidden && (
            <div
              className="play-page__debug"
              role="button"
              tabIndex={0}
              onClick={() => setDebugOverlayHidden(true)}
              onKeyDown={(e) => e.key === 'Enter' && setDebugOverlayHidden(true)}
              title="Скрыть"
            >
              phase=finishing ×
            </div>
          )}
          <div className="play-page__top-bar">
            <HomeButton />
          </div>
          <p className="play-page__message">Подведение итогов…</p>
        </div>
      )
    }
    if (showFavoritesView) {
      return (
        <div className="play-page">
          <div className="play-page__top-bar">
            <HomeButton />
          </div>
          <h2 className="play-page__subtitle">Избранное</h2>
          <ul className="play-page__fav-list">
            {favoriteQuestions.map((q: string, k: number) => (
              <li key={k}>{q}</li>
            ))}
          </ul>
          {favoriteQuestions.length === 0 && (
            <p className="play-page__message">Пока ничего нет</p>
          )}
          <div className="play-page__actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => { haptic('light'); setShowFavoritesView(false); }}
            >
              Закрыть
            </button>
            <Link to="/decks" className="btn btn--ghost play-page__back" onClick={() => haptic('light')}>
              Назад к колодам
            </Link>
          </div>
        </div>
      )
    }

    return (
      <div className="play-page play-page--success">
        <div className="play-page__top-bar">
          <HomeButton />
        </div>
        {showConfetti && <MicroConfetti duration={2000} />}
        <h1 className="play-page__title">{deck.title}</h1>
        <p className="play-page__message play-page__message--success">
          Колода пройдена
        </p>
        <div className="play-page__actions">
          <button type="button" className="btn btn--primary" onClick={() => { haptic('light'); handleRestart(); }}>
            Начать заново
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => { haptic('light'); setShowFavoritesView(true); }}
          >
            Открыть избранное
          </button>
          <Link to="/decks" className="btn btn--ghost play-page__back" onClick={() => haptic('light')}>
            Назад к колодам
          </Link>
        </div>
      </div>
    )
  }

  const swipe = useSwipeCard({
    onSwipeRight: handleSwipeRight,
    onSwipeLeft: () => {},
    containerRef: swipeWrapRef,
  })

  return (
    <div className="play-page">
      {isDebug && !debugOverlayHidden && (
        <div
          className="play-page__debug"
          role="button"
          tabIndex={0}
          onClick={() => setDebugOverlayHidden(true)}
          onKeyDown={(e) => e.key === 'Enter' && setDebugOverlayHidden(true)}
          title="Скрыть"
        >
          phase={phase} attempt={initAttempt} ×
        </div>
      )}
      <div className="play-page__top-bar">
        <HomeButton />
      </div>
      <h1 className="play-page__title">{deck.title}</h1>
      <div className="play-page__progress-wrap">
        <div className="play-page__progress-bar">
          <div
            className="play-page__progress-fill"
            style={{ width: `${((index + 1) / N) * 100}%` }}
          />
        </div>
        <p className="play-page__progress-text">
          <span className="font-mono">{index + 1}</span> / <span className="font-mono">{N}</span>
        </p>
      </div>
      <div className="play-page__question-wrap">
        <div
          ref={swipeWrapRef}
          className={`card-swipe-wrap ${swipe.state.isDragging ? 'card-swipe-wrap--dragging' : ''}`}
        >
          <div
            className={`play-page__question-panel-wrap question-card ${isExiting ? 'play-page__question-panel-wrap--exiting' : ''} ${isEntering ? 'play-page__question-panel-wrap--entering' : ''}`}
            key={index}
            {...swipe.bind}
            style={{
              ...swipe.style,
              userSelect: swipe.state.isDragging ? 'none' : undefined,
              WebkitUserSelect: swipe.state.isDragging ? 'none' : undefined,
            }}
          >
            <div className="play-page__question-panel card play-page__question-panel--animate">
              <p className="play-page__question">{currentQuestion}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="play-page__actions">
        <button type="button" className="btn btn--primary" onClick={handleNextWithAnimation}>
          Следующая
        </button>
        <button
          type="button"
          className={`btn btn--ghost ${isCurrentInFavorites ? 'btn--fav-active' : ''}`}
          onClick={handleAddToFavorites}
          disabled={isCurrentInFavorites}
        >
          {isCurrentInFavorites ? '⭐ В избранном' : '⭐ В избранное'}
        </button>
        <Link to="/decks" className="btn btn--ghost play-page__back" onClick={() => haptic('light')}>
          Назад к колодам
        </Link>
      </div>
    </div>
  )
}

export default Play
