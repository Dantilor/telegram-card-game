import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { IconBolt, IconChevron, IconDiamond, IconGamepad, IconPlay, IconStar, IconTrophy } from './homeWebIcons'
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
    description: 'Определи, кто из вас настоящий, а кто — лишь идеальная копия.',
    to: '/doubles',
    image: IMAGES.doubles.png,
    badge: 'Новая игра',
  },
  {
    id: 'mafia-shadows',
    title: 'Мафия: Тени города',
    description: getGameById('mafia-shadows')?.description.replace(/\n/g, ' • ') || 'Роли • Телефоны • Ночь и суд',
    to: '/mafia-shadows',
    image: IMAGES.mafiaShadows.png,
    badge: 'Хит вечера',
  },
  {
    id: 'infected',
    title: 'Заражённые',
    description: getGameById('infected')?.description.replace(/\n/g, ' • ') || 'Станция • Недоверие • Кто внутри',
    to: '/infected',
    image: IMAGES.infected.png,
    badge: 'Новая игра',
  },
  {
    id: 'who-is-who',
    title: 'Кто тут кто?',
    description: getGameById('who-is-who')?.description.replace(/\n/g, ' • ') || 'Ситуации • Роли • Оправдания',
    to: '/who-is-who',
    image: IMAGES.whoIsWho.png,
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
  { id: 'russia-travel', title: 'Путешествие по России', image: IMAGES.russiaTravel.png, to: '/russia-travel' },
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
  const [paused, setPaused] = useState(false)
  const touchStartX = useRef<number | null>(null)
  const reduceMotion = useRef(false)

  useEffect(() => {
    reduceMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  useEffect(() => {
    let cancelled = false
    const loadPlans = () => {
      apiGet<{ ok?: boolean; plans?: PlanOption[] }>('/api/plans')
        .then((res) => {
          if (cancelled || !res.ok || !Array.isArray(res.plans)) return
          setPlansPriceLabel(formatPlansFromPrice(res.plans))
        })
        .catch(() => {})
    }
    let idleId: number | undefined
    let timeoutId: number | undefined
    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(loadPlans, { timeout: 4000 })
    } else {
      timeoutId = window.setTimeout(loadPlans, 1500)
    }
    return () => {
      cancelled = true
      if (idleId !== undefined && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId)
      }
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [])

  useEffect(() => {
    if (paused || reduceMotion.current) return
    const id = window.setInterval(() => {
      setHeroIndex((i) => (i + 1) % HERO_SLIDES.length)
    }, 5500)
    return () => window.clearInterval(id)
  }, [paused])

  const openPremium = useCallback(() => {
    hapticImpact('light')
    setPremiumOpen(true)
  }, [])

  const goFavorites = useCallback(() => {
    haptic('light')
    if (favoritesLocked) setPremiumOpen(true)
    else navigate('/favorites')
  }, [favoritesLocked, navigate])

  const goSlide = useCallback((dir: -1 | 1) => {
    haptic('light')
    setHeroIndex((i) => (i + dir + HERO_SLIDES.length) % HERO_SLIDES.length)
  }, [])

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
        badge: 'Новое' as const,
      })),
    []
  )

  return (
    <div className="home-web-landing">
      <HomeWelcomeTop />
      <HomeWebNav onPremium={openPremium} />

      <div className="home-web-landing__themes">
        <ThemeToggle onPremiumRequired={() => setPremiumOpen(true)} />
      </div>

      <section
        className="home-web-hero"
        aria-roledescription="carousel"
        aria-label="Популярные игры"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={(e) => {
          touchStartX.current = e.changedTouches[0]?.clientX ?? null
          setPaused(true)
        }}
        onTouchEnd={(e) => {
          const start = touchStartX.current
          touchStartX.current = null
          setPaused(false)
          if (start == null) return
          const dx = (e.changedTouches[0]?.clientX ?? start) - start
          if (Math.abs(dx) < 40) return
          goSlide(dx < 0 ? 1 : -1)
        }}
      >
        <button
          type="button"
          className="home-web-hero__arrow home-web-hero__arrow--prev"
          aria-label="Предыдущий слайд"
          onClick={() => goSlide(-1)}
        >
          ‹
        </button>
        <button
          type="button"
          className="home-web-hero__arrow home-web-hero__arrow--next"
          aria-label="Следующий слайд"
          onClick={() => goSlide(1)}
        >
          ›
        </button>

        <div
          className="home-web-hero__track"
          style={{ transform: `translate3d(-${heroIndex * 100}%, 0, 0)` }}
        >
          {HERO_SLIDES.map((slide, i) => (
            <article
              key={slide.id}
              className={`home-web-hero__slide${i === heroIndex ? ' is-active' : ''}`}
              aria-hidden={i !== heroIndex}
            >
              <img
                src={slide.image}
                alt=""
                className="home-web-hero__bg"
                decoding={i === 0 ? 'sync' : 'async'}
                loading={i === 0 ? 'eager' : 'lazy'}
                draggable={false}
              />
              <div className="home-web-hero__veil" aria-hidden />
              <div className="home-web-hero__copy">
                {slide.badge ? <span className="home-web-hero__badge">{slide.badge}</span> : null}
                <h1 className="home-web-hero__title">{slide.title}</h1>
                <p className="home-web-hero__desc">{slide.description}</p>
                <div className="home-web-hero__actions">
                  <Link
                    to={slide.to}
                    className="home-web-hero__cta"
                    tabIndex={i === heroIndex ? 0 : -1}
                    onClick={() => {
                      hapticImpact('light')
                      requestFullscreenOnUserGesture()
                    }}
                  >
                    <span className="home-web-hero__cta-icon" aria-hidden>
                      <IconPlay size={11} />
                    </span>
                    Играть сейчас
                  </Link>
                  <Link
                    to={slide.to}
                    className="home-web-hero__ghost"
                    tabIndex={i === heroIndex ? 0 : -1}
                    onClick={() => haptic('light')}
                  >
                    Подробнее
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="home-web-hero__dots" role="tablist" aria-label="Слайды">
          {HERO_SLIDES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === heroIndex}
              aria-label={`Слайд ${i + 1}`}
              className={`home-web-hero__dot${i === heroIndex ? ' is-active' : ''}`}
              onClick={() => {
                haptic('light')
                setHeroIndex(i)
              }}
            />
          ))}
        </div>
      </section>

      <section className="home-web-quicks" aria-label="Быстрые действия">
        <button type="button" className="home-web-quick home-web-quick--fav" onClick={goFavorites}>
          <span className="home-web-quick__icon" aria-hidden><IconStar size={20} /></span>
          <span className="home-web-quick__label">Избранное</span>
          <span className="home-web-quick__hint">Любимые игры</span>
        </button>
        <a href="#home-web-new" className="home-web-quick home-web-quick--new" onClick={() => haptic('light')}>
          <span className="home-web-quick__icon" aria-hidden><IconBolt size={20} /></span>
          <span className="home-web-quick__label">Новые игры</span>
          <span className="home-web-quick__hint">Последние добавления</span>
        </a>
        <a href="#home-web-popular" className="home-web-quick home-web-quick--hot" onClick={() => haptic('light')}>
          <span className="home-web-quick__icon" aria-hidden><IconTrophy size={20} /></span>
          <span className="home-web-quick__label">Популярные</span>
          <span className="home-web-quick__hint">Выбор игроков</span>
        </a>
        <Link to="/games" className="home-web-quick home-web-quick--cat" onClick={() => haptic('light')}>
          <span className="home-web-quick__icon" aria-hidden><IconGamepad size={20} /></span>
          <span className="home-web-quick__label">Категории</span>
          <span className="home-web-quick__hint">Подборки по настроению</span>
        </Link>
      </section>

      {(!isPremium || loading) && (
        <button type="button" className="home-web-premium-strip" onClick={openPremium}>
          <span className="home-web-premium-strip__gem" aria-hidden><IconDiamond size={22} /></span>
          <span className="home-web-premium-strip__text">
            <strong>Premium PRO</strong>
            <span>Все игры и режимы · без автосписаний</span>
          </span>
          <span className="home-web-premium-strip__price">{loading ? '…' : plansPriceLabel}</span>
        </button>
      )}

      <section id="home-web-popular" className="home-web-section" aria-labelledby="home-web-popular-title">
        <div className="home-web-section__head">
          <div className="home-web-section__titles">
            <h2 id="home-web-popular-title">Популярные игры</h2>
            <p>Самые любимые игры нашего сообщества</p>
          </div>
          <Link to="/games" className="home-web-section__more" onClick={() => haptic('light')}>
            Весь каталог
            <IconChevron size={14} />
          </Link>
        </div>
        <ul className="home-web-popular-row">
          {popularMeta.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                className="home-web-game-card"
                onClick={() => {
                  haptic('light')
                  navigate(g.to)
                }}
              >
                <span className="home-web-game-card__media">
                  <Thumb image={g.image} avif={'avif' in g ? g.avif : undefined} className="home-web-game-card__img" />
                  <span className="home-web-game-card__play" aria-hidden><IconPlay size={11} /></span>
                </span>
                <span className="home-web-game-card__body">
                  <span className="home-web-game-card__title">{g.title}</span>
                  {g.playersLabel ? <span className="home-web-game-card__meta">{g.playersLabel}</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section id="home-web-new" className="home-web-section" aria-labelledby="home-web-new-title">
        <div className="home-web-section__head">
          <div className="home-web-section__titles">
            <h2 id="home-web-new-title">Новые игры</h2>
            <p>Самые свежие, которые стоит попробовать</p>
          </div>
          <Link to="/games" className="home-web-section__more" onClick={() => haptic('light')}>
            Смотреть все
            <IconChevron size={14} />
          </Link>
        </div>
        <ul className="home-web-new-row">
          {newMeta.map((g) => (
            <li key={`new-${g.id}`}>
              <button
                type="button"
                className="home-web-new-card"
                onClick={() => {
                  haptic('light')
                  navigate(g.to)
                }}
              >
                <span className="home-web-new-card__media">
                  <Thumb image={g.image} avif={'avif' in g ? g.avif : undefined} className="home-web-new-card__img" />
                  <span className="home-web-new-card__badge">{g.badge}</span>
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
