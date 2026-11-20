import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { haptic } from '../utils/telegram'
import { hapticImpact, hapticSelection } from '../utils/haptics'
import { requestFullscreenOnUserGesture } from '../lib/telegramTheme'
import { usePremium } from '../contexts/PremiumContext'
import { isGameLocked } from '../lib/access'
import { isModeLocked } from '../utils/access'
import { MODES, type ModeId } from '../data/modes'
import { getGameById } from '../data/games'
import { formatGameTags } from '../utils/gameTags'
import { apiGet } from '../lib/api'
import PremiumOverlay from '../components/PremiumOverlay'
import AdultConfirmModal from '../components/AdultConfirmModal'
import WebSiteFooter from '../components/web/WebSiteFooter'
import markUrl from './gnh-home-ref/assets/reference-mark.webp'
import crystalUrl from './gnh-home-ref/assets/reference-crystal.webp'
import { RESPONSIVE_ARTWORK } from '../assets/images'
import ResponsiveArtwork from '../components/ResponsiveArtwork'
import './gnh-home-ref/styles/fonts.css'
import './gnh-home-ref/styles/home-design.css'
import './gnh-home-ref/home-ref-extras.css'
import '../styles/web-layout.css'
import './gnh-home-ref/home-portal.css'

const PICK_GAME_IDS: Record<string, string> = {
  '/mafia-shadows': 'mafia-shadows',
  '/doubles': 'doubles',
  '/infected': 'infected',
  '/who-is-who': 'who-is-who',
  '/russia-travel': 'russia-travel',
  '/alias': 'alias',
  '/mafia': 'mafia',
  '/sled': 'sled',
}

export type HomeReferencePick = {
  title: string
  image: string
  avif?: string
  to: string
}

type HomeReferenceProps = {
  popular: readonly HomeReferencePick[]
  fresh: readonly HomeReferencePick[]
  plansPriceLabel: string
  plansLoading: boolean
  showPremium: boolean
  onFavorites: () => void
  onPremium: () => void
  /** Compact tariffs for locked games/modes (no long Premium pitch). */
  onPremiumGate?: () => void
  onWheel?: () => void
  onPick: (to: string) => void
  premiumOpen: boolean
  onPremiumClose: () => void
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  )
}

function PlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" stroke="none">
      <path d="M8 5.5v13l10-6.5z" fill="currentColor" />
    </svg>
  )
}

function Chevron() {
  return (
    <Icon>
      <path d="M9 5l7 7-7 7" />
    </Icon>
  )
}

function ModeGlyph({ id }: { id: string }) {
  if (id === 'party') {
    return (
      <Icon>
        <path d="M16 20v-1.4a3.2 3.2 0 0 0-3.2-3.2H7.2A3.2 3.2 0 0 0 4 18.6V20" />
        <circle cx="10" cy="8.2" r="2.6" />
        <path d="M20 20v-1.2a2.8 2.8 0 0 0-2.1-2.7" />
        <path d="M16.2 5.7a2.6 2.6 0 0 1 0 5" />
      </Icon>
    )
  }
  if (id === 'adult') {
    return (
      <Icon>
        <path d="M12 3.2s2.1 2.8 2.1 4.8c0-1.5 1.5-2.4 2.2-3 1.5 1.7 2.5 3.6 2.5 5.8A6.8 6.8 0 1 1 5.2 10.8c0-2.2 1.1-4.1 2.5-5.8.7.6 2.2 1.5 2.2 3 0-2 2.1-4.8 2.1-4.8z" />
      </Icon>
    )
  }
  if (id === 'psychology') {
    return (
      <Icon>
        <path d="M8.2 14.8V13a2.7 2.7 0 0 1-1.6-2.4 2.3 2.3 0 0 1 1.2-3.8A3.1 3.1 0 0 1 12 4.6a3.1 3.1 0 0 1 4.2 2.2 2.3 2.3 0 0 1 1.2 3.8A2.7 2.7 0 0 1 15.8 13v1.8" />
        <path d="M9.2 18.2h5.6M12 14.8v3.4" />
      </Icon>
    )
  }
  if (id === 'lifeChoice') {
    return (
      <Icon>
        <circle cx="12" cy="12" r="7" />
        <circle cx="12" cy="12" r="3" />
        <path d="M12 5v2.2M12 16.8V19M5 12h2.2M16.8 12H19" />
      </Icon>
    )
  }
  return (
    <Icon>
      <path d="M12 19s-6.5-3.9-6.5-8.1A3.6 3.6 0 0 1 12 8.4a3.6 3.6 0 0 1 6.5 2.5C18.5 15.1 12 19 12 19z" />
    </Icon>
  )
}

function usePlayerCount() {
  const [usersCount, setUsersCount] = useState<number | null>(null)
  useEffect(() => {
    let cancelled = false
    apiGet<{ usersCount: number }>('/api/public-stats')
      .then((data) => {
        if (!cancelled && Number.isSafeInteger(data.usersCount) && data.usersCount >= 0) {
          setUsersCount(data.usersCount)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])
  return usersCount
}

function PlayerCount({ usersCount, className }: { usersCount: number; className: string }) {
  const formatted = new Intl.NumberFormat('ru-RU').format(usersCount)
  return (
    <p className={className} aria-label={`${formatted} игроков выбирают GNH`}>
      <strong>{formatted}</strong>
      <span>игроков выбирают GNH</span>
    </p>
  )
}

function useHeroShift(heroRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const hero = heroRef.current
    if (!hero) return
    const pointer = window.matchMedia('(min-width: 761px) and (pointer: fine)')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    let nextX = 0
    let nextY = 0
    const reset = () => {
      cancelAnimationFrame(frame)
      frame = 0
      hero.style.removeProperty('--hx')
      hero.style.removeProperty('--hy')
    }
    const flush = () => {
      frame = 0
      hero.style.setProperty('--hx', `${nextX}px`)
      hero.style.setProperty('--hy', `${nextY}px`)
    }
    const move = (event: PointerEvent) => {
      if (!pointer.matches || reducedMotion.matches) return
      const rect = hero.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      const x = Math.max(-0.5, Math.min(0.5, (event.clientX - rect.left) / rect.width - 0.5))
      const y = Math.max(-0.5, Math.min(0.5, (event.clientY - rect.top) / rect.height - 0.5))
      nextX = x * -10
      nextY = y * -7
      if (!frame) frame = requestAnimationFrame(flush)
    }
    hero.addEventListener('pointermove', move, { passive: true })
    hero.addEventListener('pointerleave', reset)
    pointer.addEventListener('change', reset)
    reducedMotion.addEventListener('change', reset)
    return () => {
      reset()
      hero.removeEventListener('pointermove', move)
      hero.removeEventListener('pointerleave', reset)
      pointer.removeEventListener('change', reset)
      reducedMotion.removeEventListener('change', reset)
    }
  }, [heroRef])
}

function HomeGameCard({
  pick,
  onOpen,
}: {
  pick: HomeReferencePick
  onOpen: (to: string) => void
}) {
  const { isPremium } = usePremium()
  const gameId = PICK_GAME_IDS[pick.to]
  const game = gameId ? getGameById(gameId) : undefined
  const locked = game ? isGameLocked(game.id, isPremium) : false
  const badge = locked ? 'PREMIUM' : game?.catalogBadge === 'new' ? 'NEW' : null
  const players = game?.playersLabel
  const note = game ? formatGameTags(game.description) : ''

  return (
    <article className="game-card">
      <div className="game-cover" aria-hidden="true">
        {pick.avif ? (
          <picture>
            <source type="image/avif" srcSet={pick.avif} />
            <img src={pick.image} alt="" />
          </picture>
        ) : (
          <img src={pick.image} alt="" />
        )}
      </div>
      <button
        type="button"
        className="game-open"
        aria-label={pick.title}
        onClick={() => onOpen(pick.to)}
      >
        <span className="game-info">
          <span className="game-title">{pick.title}</span>
          <span className="game-metadata">
            {players ? (
              <span>
                <Icon>
                  <path d="M16 19.5v-1.2A3 3 0 0 0 13 15.3H7a3 3 0 0 0-3 3v1.2" />
                  <circle cx="10" cy="8.2" r="2.5" />
                </Icon>
                {players}
              </span>
            ) : null}
            {note ? <span className="gnh-meta-note">{note}</span> : null}
            <span className="card-play" aria-hidden="true">
              <PlayGlyph />
            </span>
          </span>
        </span>
      </button>
      {badge ? (
        <div className="gnh-existing-badges">
          <span className={`gnh-card-badge gnh-card-badge--${badge === 'NEW' ? 'new' : 'premium'}`}>{badge}</span>
        </div>
      ) : null}
    </article>
  )
}

function HomeReference({
  popular,
  fresh,
  plansPriceLabel,
  plansLoading,
  showPremium,
  onFavorites,
  onPremium,
  onPremiumGate,
  onWheel,
  onPick,
  premiumOpen,
  onPremiumClose,
}: HomeReferenceProps) {
  const openPremiumGate = onPremiumGate || onPremium

  const navigate = useNavigate()
  const { isPremium } = usePremium()
  const heroRef = useRef<HTMLElement | null>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [adultOpen, setAdultOpen] = useState(false)
  const [dotCount, setDotCount] = useState(1)
  const [activeDot, setActiveDot] = useState(0)
  const usersCount = usePlayerCount()
  useHeroShift(heroRef)

  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    const measure = () => {
      const pages = Math.max(1, Math.round(el.scrollWidth / Math.max(el.clientWidth, 1)))
      setDotCount(pages)
      const index = Math.round(el.scrollLeft / Math.max(el.clientWidth, 1))
      setActiveDot(Math.min(pages - 1, Math.max(0, index)))
    }
    measure()
    el.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      el.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }, [popular.length])

  const openMode = (modeId: ModeId) => {
    hapticSelection()
    setMenuOpen(false)
    if (isModeLocked(modeId, isPremium)) {
      openPremiumGate()
      return
    }
    if (modeId === 'adult') {
      setAdultOpen(true)
      return
    }
    navigate(`/mode/${modeId}`)
  }

  const scrollCards = (index: number) => {
    const el = gridRef.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ left: index * el.clientWidth, behavior: reduce ? 'auto' : 'smooth' })
  }

  const priceLabel = plansLoading ? 'Проверяем…' : plansPriceLabel

  return (
    <div className="gnh-home-scroll">
      <div className="gnh-home-ref home-mode">
        <div className="page-atmosphere" aria-hidden="true" />
        <header className="site-header">
          <div className="header-inner wrap">
            <Link to="/" className="brand" onClick={() => haptic('light')} aria-label="GameNight Host">
              <img src={markUrl} alt="" />
              <span>GNH</span>
            </Link>
            {usersCount !== null ? (
              <PlayerCount usersCount={usersCount} className="gnh-player-count gnh-player-count--bar" />
            ) : null}
            <nav className="desktop-nav" aria-label="Главная навигация">
              <Link
                to="/games"
                className="nav-link active"
                data-nav="catalog"
                onClick={() => {
                  hapticImpact('light')
                  requestFullscreenOnUserGesture()
                }}
                onPointerEnter={() => {
                  void import('./Games')
                }}
              >
                Каталог
              </Link>
              <button type="button" className="nav-link" onClick={onFavorites}>
                Избранное
              </button>
              <Link to="/profile" className="nav-link profile-link" onClick={() => haptic('light')}>
                <Icon>
                  <circle cx="12" cy="8" r="3" />
                  <path d="M5.5 19.2a6.5 6.5 0 0 1 13 0" />
                </Icon>
                Профиль
              </Link>
              {showPremium ? (
                <button type="button" className="premium-button" onClick={onPremium}>
                  {priceLabel}
                </button>
              ) : null}
            </nav>
            <button
              type="button"
              className="menu-button"
              aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <Icon>
                {menuOpen ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </Icon>
            </button>
          </div>
        </header>
        <div className={`gnh-menu${menuOpen ? ' is-open' : ''}`}>
          <Link to="/games" className="nav-link" onClick={() => { haptic('light'); setMenuOpen(false) }}>
            Каталог
          </Link>
          <button type="button" className="nav-link" onClick={() => { onFavorites(); setMenuOpen(false) }}>
            Избранное
          </button>
          <Link to="/profile" className="nav-link" onClick={() => { haptic('light'); setMenuOpen(false) }}>
            Профиль
          </Link>
          {showPremium ? (
            <button type="button" className="nav-link" onClick={() => { onPremium(); setMenuOpen(false) }}>
              {priceLabel}
            </button>
          ) : null}
        </div>
        <main className="gnh-home-main">
          <section className="hero gnh-asset-hero" ref={heroRef}>
            <div className="gnh-asset-hero__visual" aria-hidden="true">
              <ResponsiveArtwork artwork={RESPONSIVE_ARTWORK.portal} alt="" priority />
            </div>
            <div className="hero-shade" aria-hidden="true" />
            <div className="hero-inner wrap gnh-asset-hero__copy">
              <div className="hero-copy">
                <h1>
                  <span>GameNight</span>
                  <span>Host</span>
                </h1>
                <p className="hero-subtitle">Твои игры. Твои правила.</p>
                <div className="hero-cta-row">
                  <Link
                    to="/games"
                    className="button button-primary hero-play"
                    onClick={() => {
                      hapticImpact('light')
                      requestFullscreenOnUserGesture()
                    }}
                    onPointerEnter={() => {
                      void import('./Games')
                    }}
                  >
                    <PlayGlyph />
                    Начать игру
                  </Link>
                  {onWheel ? (
                    <button type="button" className="button button-light hero-wheel" onClick={onWheel}>
                      Колесо игр
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
          {usersCount !== null ? (
            <PlayerCount usersCount={usersCount} className="gnh-player-count gnh-player-count--mobile" />
          ) : null}
          <section className="categories-section wrap" aria-labelledby="gnh-modes-title">
            <div className="category-heading">
              <h2 id="gnh-modes-title">Выбери режим</h2>
            </div>
            <div className="moods">
              {MODES.map((mode) => {
                const locked = isModeLocked(mode.id, isPremium)
                return (
                  <button
                    key={mode.id}
                    type="button"
                    className={`mood mood--${mode.id}`}
                    onClick={() => openMode(mode.id)}
                  >
                    <ModeGlyph id={mode.id} />
                    <span>{mode.title}</span>
                    {locked ? <span className="mood-lock">PREMIUM</span> : null}
                  </button>
                )
              })}
            </div>
          </section>
          {showPremium ? (
            <aside className="premium-banner wrap" aria-label="Premium">
              <div className="premium-glow" aria-hidden="true" />
              <div className="crystal-scene" aria-hidden="true">
                <img className="crystal-crop" src={crystalUrl} alt="" />
              </div>
              <div className="premium-copy">
                <h2>
                  Premium
                  <span className="gnh-card-badge gnh-card-badge--premium">PRO</span>
                </h2>
                <p>Открывает все игры и режимы • без автосписаний</p>
                <button type="button" className="button button-light" onClick={onPremium}>
                  {priceLabel}
                </button>
              </div>
            </aside>
          ) : null}
          <section className="catalog-section wrap" aria-labelledby="gnh-popular-title">
            <div className="section-heading">
              <h2 id="gnh-popular-title">Популярные</h2>
              <Link to="/games" className="all-games-link" onClick={() => haptic('light')}>
                Весь каталог
                <Chevron />
              </Link>
            </div>
            <div className="game-grid" ref={gridRef}>
              {popular.map((pick) => (
                <HomeGameCard key={pick.title} pick={pick} onOpen={onPick} />
              ))}
            </div>
            {dotCount > 1 ? (
              <div className="carousel-dots" role="tablist" aria-label="Популярные игры">
                {Array.from({ length: dotCount }, (_, index) => (
                  <button
                    key={index}
                    type="button"
                    className={index === activeDot ? 'active' : undefined}
                    aria-label={`Страница ${index + 1}`}
                    onClick={() => scrollCards(index)}
                  />
                ))}
              </div>
            ) : null}
          </section>
          <section className="new-section wrap" aria-labelledby="gnh-new-title">
            <div className="section-heading">
              <h2 id="gnh-new-title">Новые игры</h2>
              <Link to="/games" className="all-games-link" onClick={() => haptic('light')}>
                Смотреть все
                <Chevron />
              </Link>
            </div>
            <div className="new-grid">
              <div className="new-games">
                {fresh.map((pick) => (
                  <HomeGameCard key={`new-${pick.title}`} pick={pick} onOpen={onPick} />
                ))}
              </div>
            </div>
          </section>
          <section className="why-section wrap" aria-labelledby="gnh-why-title">
            <div className="section-heading why-heading">
              <div>
                <h2 id="gnh-why-title">Почему выбирают GameNight Host</h2>
                <p className="why-lead">Один вечер. Сотни поводов собраться.</p>
              </div>
            </div>
            <div className="why-grid">
              <article className="why-card">
                <span className="why-card__icon" aria-hidden="true">
                  <Icon>
                    <path d="M13 2 4 14h7l-1 8 10-14h-7l0-6Z" />
                  </Icon>
                </span>
                <h3>Больше никаких скучных вечеров</h3>
                <p>
                  Обычная встреча превращается в вечер смеха, неожиданных признаний и ярких эмоций.
                  Просто выбирай игру — и начинай веселье.
                </p>
              </article>
              <article className="why-card">
                <span className="why-card__icon" aria-hidden="true">
                  <Icon>
                    <rect x="3" y="8" width="18" height="10" rx="2.5" />
                    <path d="M8 12h0.01M12 12h0.01M16 12h0.01" />
                    <path d="M7 8V6.5A2.5 2.5 0 0 1 9.5 4h5A2.5 2.5 0 0 1 17 6.5V8" />
                  </Icon>
                </span>
                <h3>Все развлечения в одном месте</h3>
                <p>
                  Мафия, детективы, игры для пар, вечеринки и интерактивные истории. Меняй жанры
                  и настроение, не выходя из GameNight Host.
                </p>
              </article>
              <article className="why-card">
                <span className="why-card__icon" aria-hidden="true">
                  <Icon>
                    <path d="M5 16.5a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4" />
                    <circle cx="12" cy="7.5" r="3" />
                    <path d="m9.2 4.2 1.1 1.7h1.8l-1.4 1.2.5 1.9L9.2 7.8 7.2 9l.5-1.9L6.3 5.9h1.8Z" />
                  </Icon>
                </span>
                <h3>Один Premium — для всей компании</h3>
                <p>
                  Подписка нужна только ведущему. Приглашай друзей и открывай все возможности —
                  остальным покупать Premium не придётся.
                </p>
              </article>
            </div>
          </section>
        </main>
        <WebSiteFooter />
        <nav className="mobile-nav" aria-label="Нижняя навигация">
          <Link to="/" className="active" data-nav="home" onClick={() => haptic('light')}>
            <Icon>
              <path d="M4 11.2 12 4l8 7.2" />
              <path d="M7 10.5V19h10v-8.5" />
            </Icon>
            Главная
          </Link>
          <Link
            to="/games"
            data-nav="catalog"
            onClick={() => {
              hapticImpact('light')
              requestFullscreenOnUserGesture()
            }}
          >
            <Icon>
              <rect x="4" y="4" width="7" height="7" rx="1.4" />
              <rect x="13" y="4" width="7" height="7" rx="1.4" />
              <rect x="4" y="13" width="7" height="7" rx="1.4" />
              <rect x="13" y="13" width="7" height="7" rx="1.4" />
            </Icon>
            Каталог
          </Link>
          <button type="button" onClick={onFavorites}>
            <Icon>
              <path d="m12 4.2 2.1 4.4 4.8.7-3.5 3.4.8 4.8L12 15.2 7.8 17.5l.8-4.8L5.1 9.3l4.8-.7L12 4.2z" />
            </Icon>
            Избранное
          </button>
          <Link to="/profile" onClick={() => haptic('light')}>
            <Icon>
              <circle cx="12" cy="8" r="3" />
              <path d="M5.5 19.2a6.5 6.5 0 0 1 13 0" />
            </Icon>
            Профиль
          </Link>
          {showPremium ? (
            <button type="button" onClick={onPremium}>
              <Icon>
                <path d="M12 3.5 14.4 9l5.6.6-4.3 3.8 1.2 5.5L12 16.2 7.1 18.9 8.3 13.4 4 9.6 9.6 9 12 3.5z" />
              </Icon>
              Тарифы
            </button>
          ) : null}
        </nav>
        <PremiumOverlay isOpen={premiumOpen} onClose={onPremiumClose} />
        <AdultConfirmModal
          isOpen={adultOpen}
          onConfirm={() => {
            setAdultOpen(false)
            navigate('/mode/adult')
          }}
          onCancel={() => setAdultOpen(false)}
        />
      </div>
    </div>
  )
}

export default HomeReference