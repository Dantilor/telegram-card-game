import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { haptic } from '../utils/telegram'
import { hapticImpact } from '../utils/haptics'
import { requestFullscreenOnUserGesture } from '../lib/telegramTheme'
import { usePremium } from '../contexts/PremiumContext'
import { isFavoritesLocked } from '../utils/access'
import { apiGet } from '../lib/api'
import { formatPlansFromPrice, type PlanOption } from '../utils/planLabel'
import ThemeToggle from '../components/ThemeToggle'
import HomeWelcomeTop from '../components/HomeWelcomeTop'
import HomeWebNav from '../components/HomeWebNav'
import PremiumOverlay from '../components/PremiumOverlay'
import { GAMES, getGameById } from '../data/games'
import { HOME_PICK_THUMBS, IMAGES } from '../assets/images'
import pickMafiaShadowsAvif from '../assets/optimized/home-pick-mafia-shadows.avif'
import pickDoublesAvif from '../assets/optimized/home-pick-doubles.avif'
import pickInfectedAvif from '../assets/optimized/home-pick-infected.avif'
import './HomeWeb.css'

type HeroSlide = {
  id: string
  title: string
  description: string
  to: string
  image: string
  badge?: string
}

const HERO_SLIDES: HeroSlide[] = [
  {
    id: 'doubles',
    title: 'Двойники',
    description: getGameById('doubles')?.description.replace(/\n/g, ' · ') || 'Личности · Досье · Кто настоящий',
    to: '/doubles',
    image: IMAGES.doubles.png,
    badge: 'Новая игра',
  },
  {
    id: 'mafia-shadows',
    title: 'Мафия: Тени города',
    description: getGameById('mafia-shadows')?.description.replace(/\n/g, ' · ') || 'Роли · Телефоны · Ночь и суд',
    to: '/mafia-shadows',
    image: IMAGES.mafiaShadows.png,
    badge: 'Хит вечера',
  },
  {
    id: 'infected',
    title: 'Заражённые',
    description: getGameById('infected')?.description.replace(/\n/g, ' · ') || 'Станция · Недоверие · Кто внутри',
    to: '/infected',
    image: IMAGES.infected.png,
    badge: 'Новая игра',
  },
]

const POPULAR = [
  { id: 'mafia-shadows', title: 'Мафия: Тени города', image: HOME_PICK_THUMBS.mafiaShadows, avif: pickMafiaShadowsAvif, to: '/mafia-shadows' },
  { id: 'doubles', title: 'Двойники', image: HOME_PICK_THUMBS.doubles, avif: pickDoublesAvif, to: '/doubles' },
  { id: 'infected', title: 'Заражённые', image: HOME_PICK_THUMBS.infected, avif: pickInfectedAvif, to: '/infected' },
  { id: 'sled', title: 'СЛЕД', image: IMAGES.sled.png, to: '/sled' },
  { id: 'who-is-who', title: 'Кто тут кто?', image: IMAGES.whoIsWho.png, to: '/who-is-who' },
] as const

const NEW_GAMES = [
  { id: 'who-is-who', title: 'Кто тут кто?', image: IMAGES.whoIsWho.png, to: '/who-is-who' },
  { id: 'russia-travel', title: 'Где мы?', image: IMAGES.russiaTravel.png, to: '/russia-travel' },
  { id: 'infected', title: 'Заражённые', image: HOME_PICK_THUMBS.infected, avif: pickInfectedAvif, to: '/infected' },
  { id: 'doubles', title: 'Двойники', image: HOME_PICK_THUMBS.doubles, avif: pickDoublesAvif, to: '/doubles' },
] as const

function Thumb({ image, avif, className }: { image: string; avif?: string; className: string }) {
  if (!avif) return <img src={image} alt="" className={className} decoding="async" loading="lazy" />
  return (
    <picture>
      <source type="image/avif" srcSet={avif} />
      <img src={image} alt="" className={className} decoding="async" loading="lazy" />
    </picture>
  )
}

export default function HomeWeb() {
  const navigate = useNavigate()
  const { isPremium, loading } = usePremium()
  const favoritesLocked = isFavoritesLocked(isPremium)
  const [premiumOpen, setPremiumOpen] = useState(false)
  const [plansPriceLabel, setPlansPriceLabel] = useState('Тарифы')
  const [heroIndex, setHeroIndex] = useState(0)

  useEffect(() => {
    let cancelled = false
    apiGet<{ ok?: boolean; plans?: PlanOption[] }>('/api/plans')
      .then((res) => {
        if (cancelled || !res.ok || !Array.isArray(res.plans)) return
        setPlansPriceLabel(formatPlansFromPrice(res.plans))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => {
      setHeroIndex((i) => (i + 1) % HERO_SLIDES.length)
    }, 6500)
    return () => window.clearInterval(id)
  }, [])

  const slide = HERO_SLIDES[heroIndex] ?? HERO_SLIDES[0]

  const openPremium = useCallback(() => {
    hapticImpact('light')
    setPremiumOpen(true)
  }, [])

  const goFavorites = useCallback(() => {
    haptic('light')
    if (favoritesLocked) setPremiumOpen(true)
    else navigate('/favorites')
  }, [favoritesLocked, navigate])

  const popularMeta = useMemo(
    () =>
      POPULAR.map((g) => ({
        ...g,
        playersLabel: getGameById(g.id)?.playersLabel,
      })),
    []
  )

  const newMeta = useMemo(
    () =>
      NEW_GAMES.map((g) => ({
        ...g,
        badge: getGameById(g.id)?.catalogBadge === 'new' ? 'Новое' : undefined,
      })),
    []
  )

  return (
    <div className="home-web-landing">
      <div className="home-web-landing__glow home-web-landing__glow--tl" aria-hidden />
      <div className="home-web-landing__glow home-web-landing__glow--br" aria-hidden />

      <HomeWelcomeTop />
      <HomeWebNav onPremium={openPremium} />

      <div className="home-web-landing__themes">
        <ThemeToggle onPremiumRequired={() => setPremiumOpen(true)} />
      </div>

      <section className="home-web-hero" aria-roledescription="carousel" aria-label="Популярные игры">
        <button
          type="button"
          className="home-web-hero__arrow home-web-hero__arrow--prev"
          aria-label="Предыдущий слайд"
          onClick={() => setHeroIndex((i) => (i - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)}
        >
          ‹
        </button>
        <button
          type="button"
          className="home-web-hero__arrow home-web-hero__arrow--next"
          aria-label="Следующий слайд"
          onClick={() => setHeroIndex((i) => (i + 1) % HERO_SLIDES.length)}
        >
          ›
        </button>

        <div className="home-web-hero__stage" key={slide.id}>
          <img src={slide.image} alt="" className="home-web-hero__bg" decoding="async" />
          <div className="home-web-hero__veil" aria-hidden />
          <div className="home-web-hero__copy">
            {slide.badge ? <span className="home-web-hero__badge">{slide.badge}</span> : null}
            <h1 className="home-web-hero__title">{slide.title}</h1>
            <p className="home-web-hero__desc">{slide.description}</p>
            <div className="home-web-hero__actions">
              <Link
                to={slide.to}
                className="home-web-hero__cta"
                onClick={() => {
                  hapticImpact('light')
                  requestFullscreenOnUserGesture()
                }}
              >
                <span className="home-web-hero__cta-icon" aria-hidden />
                Играть сейчас
              </Link>
              <Link to={slide.to} className="home-web-hero__ghost" onClick={() => haptic('light')}>
                Подробнее
              </Link>
            </div>
          </div>
        </div>

        <div className="home-web-hero__dots" role="tablist" aria-label="Слайды">
          {HERO_SLIDES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === heroIndex}
              className={`home-web-hero__dot${i === heroIndex ? ' is-active' : ''}`}
              onClick={() => setHeroIndex(i)}
            />
          ))}
        </div>
      </section>

      <section className="home-web-quicks" aria-label="Быстрые действия">
        <button type="button" className="home-web-quick home-web-quick--fav" onClick={goFavorites}>
          <span className="home-web-quick__icon" aria-hidden>★</span>
          <span className="home-web-quick__label">Избранное</span>
        </button>
        <a href="#home-web-new" className="home-web-quick home-web-quick--new" onClick={() => haptic('light')}>
          <span className="home-web-quick__icon" aria-hidden>⚡</span>
          <span className="home-web-quick__label">Новые игры</span>
        </a>
        <a href="#home-web-popular" className="home-web-quick home-web-quick--hot" onClick={() => haptic('light')}>
          <span className="home-web-quick__icon" aria-hidden>🏆</span>
          <span className="home-web-quick__label">Популярные</span>
        </a>
        <Link to="/games" className="home-web-quick home-web-quick--cat" onClick={() => haptic('light')}>
          <span className="home-web-quick__icon" aria-hidden>🎮</span>
          <span className="home-web-quick__label">Категории</span>
        </Link>
      </section>

      {(!isPremium || loading) && (
        <button type="button" className="home-web-premium-strip" onClick={openPremium}>
          <span className="home-web-premium-strip__gem" aria-hidden>◆</span>
          <span className="home-web-premium-strip__text">
            <strong>Premium PRO</strong>
            <span>Все игры и режимы · без автосписаний</span>
          </span>
          <span className="home-web-premium-strip__price">{loading ? '…' : plansPriceLabel}</span>
        </button>
      )}

      <section id="home-web-popular" className="home-web-section" aria-labelledby="home-web-popular-title">
        <div className="home-web-section__head">
          <h2 id="home-web-popular-title">Популярные игры</h2>
          <Link to="/games" className="home-web-section__more" onClick={() => haptic('light')}>
            Весь каталог →
          </Link>
        </div>
        <ul className="home-web-popular-grid">
          {popularMeta.map((g) => (
            <li key={g.id}>
              <button type="button" className="home-web-game-card" onClick={() => { haptic('light'); navigate(g.to) }}>
                <span className="home-web-game-card__media">
                  <Thumb image={g.image} avif={'avif' in g ? g.avif : undefined} className="home-web-game-card__img" />
                </span>
                <span className="home-web-game-card__body">
                  <span className="home-web-game-card__title">{g.title}</span>
                  {g.playersLabel ? <span className="home-web-game-card__meta">{g.playersLabel}</span> : null}
                </span>
                <span className="home-web-game-card__play" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section id="home-web-new" className="home-web-section" aria-labelledby="home-web-new-title">
        <div className="home-web-section__head">
          <h2 id="home-web-new-title">Новые игры</h2>
          <Link to="/games" className="home-web-section__more" onClick={() => haptic('light')}>
            Смотреть все →
          </Link>
        </div>
        <ul className="home-web-new-grid">
          {newMeta.map((g) => (
            <li key={`new-${g.id}`}>
              <button type="button" className="home-web-new-card" onClick={() => { haptic('light'); navigate(g.to) }}>
                <span className="home-web-new-card__media">
                  <Thumb image={g.image} avif={'avif' in g ? g.avif : undefined} className="home-web-new-card__img" />
                  {g.badge ? <span className="home-web-new-card__badge">{g.badge}</span> : null}
                </span>
                <span className="home-web-new-card__title">{g.title}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <p className="home-web-landing__footnote" aria-hidden>
        {GAMES.filter((g) => g.status === 'ready').length} игр готовы к запуску
      </p>

      <PremiumOverlay isOpen={premiumOpen} onClose={() => setPremiumOpen(false)} />
    </div>
  )
}
