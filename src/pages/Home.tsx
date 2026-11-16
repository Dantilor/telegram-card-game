import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { haptic } from '../utils/telegram'
import { hapticImpact } from '../utils/haptics'
import { requestFullscreenOnUserGesture } from '../lib/telegramTheme'
import { usePremium } from '../contexts/PremiumContext'
import { isFavoritesLocked } from '../utils/access'
import { apiGet } from '../lib/api'
import { formatPlansFromPrice, type PlanOption } from '../utils/planLabel'
import { useTheme } from '../hooks/useTheme'
import { useWebHeroParallax } from '../hooks/useWebHeroParallax'
import { isWebShell } from '../config/shell'
import ThemeToggle from '../components/ThemeToggle'
import HomeWelcomeTop from '../components/HomeWelcomeTop'
import HomePremiumBanner from '../components/HomePremiumBanner'
import PremiumOverlay from '../components/PremiumOverlay'
import { HOME_PICK_THUMBS, IMAGES } from '../assets/images'
import { HIGH_FETCH_PRIORITY } from '../utils/scheduleWhenIdle'
import pickMafiaShadowsAvif from '../assets/optimized/home-pick-mafia-shadows.avif'
import pickDoublesAvif from '../assets/optimized/home-pick-doubles.avif'
import pickInfectedAvif from '../assets/optimized/home-pick-infected.avif'
import heroPortal from '../assets/optimized/home-hero-neon.webp'
import iconFavoriteStar from '../assets/icons/gnh/action-favorite-star.svg'
import iconProfileUser from '../assets/icons/gnh/action-profile-user.svg'
import iconChevronRight from '../assets/icons/gnh/chevron-right.svg'
import iconLightFavorite from '../assets/icons/gnh-light-pro/light-favorite-star-pro.svg'
import iconLightProfile from '../assets/icons/gnh-light-pro/light-profile-user-pro.svg'
import iconLightChevronRight from '../assets/icons/gnh-light-pro/light-chevron-right-pro.svg'
import lightHeroExact from '../assets/optimized/home-hero-light.webp'
import heroSunset from '../assets/optimized/home-hero-sunset.webp'
import iconSunsetFavorite from '../assets/icons/gnh-sunset-pro/sunset-favorite-star-pro.svg'
import iconSunsetProfile from '../assets/icons/gnh-sunset-pro/sunset-profile-user-pro.svg'
import iconSunsetChevronRight from '../assets/icons/gnh-sunset-pro/sunset-chevron-right-pro.svg'
import heroCalm from '../assets/optimized/home-hero-calm.webp'
import iconCalmFavorite from '../assets/icons/gnh-calm-pro/calm-favorite-star-pro.svg'
import iconCalmProfile from '../assets/icons/gnh-calm-pro/calm-profile-user-pro.svg'
import iconCalmChevronRight from '../assets/icons/gnh-calm-pro/calm-chevron-right-pro.svg'
import './Home.css'

const APP_FEATURES = [
  'Колоды вопросов',
  'Ассоциации',
  'Мафия',
  'Активитус',
  'Саботаж',
  'Битва умов',
  'Правда или действие',
  'Кто тут кто?',
]

const HOME_PICKS = [
  { title: 'Мафия: Тени города', image: HOME_PICK_THUMBS.mafiaShadows, avif: pickMafiaShadowsAvif, gameId: 'mafia-shadows', to: '/mafia-shadows' },
  { title: 'Двойники', image: HOME_PICK_THUMBS.doubles, avif: pickDoublesAvif, gameId: 'doubles', to: '/doubles' },
  { title: 'Заражённые', image: HOME_PICK_THUMBS.infected, avif: pickInfectedAvif, gameId: 'infected', to: '/infected' },
] as const

type HomePickItem = {
  title: string
  image: string
  avif?: string
  to: string
}

const HOME_NEW_PICKS: HomePickItem[] = [
  { title: 'Кто тут кто?', image: IMAGES.whoIsWho.png, to: '/who-is-who' },
  { title: 'Путешествие по России', image: IMAGES.russiaTravel.png, to: '/russia-travel' },
  { title: 'Заражённые', image: HOME_PICK_THUMBS.infected, avif: pickInfectedAvif, to: '/infected' },
]

function HomePickThumb({ image, avif }: { image: string; avif?: string }) {
  if (!avif) {
    return <img src={image} alt="" className="home-picks__thumb" decoding="async" loading="lazy" />
  }
  return (
    <picture>
      <source type="image/avif" srcSet={avif} />
      <img src={image} alt="" className="home-picks__thumb" decoding="async" loading="lazy" />
    </picture>
  )
}

function HomePlayIcon({ size = 'picks' }: { size?: 'picks' | 'cta' }) {
  return (
    <span className={`home-play-btn home-play-btn--${size}`} aria-hidden>
      <span className="home-play-btn__triangle" />
    </span>
  )
}

type HomeThemePrefix = 'neon' | 'light' | 'sunset' | 'calm'

function HomePicksSections({
  prefix,
  onPick,
  web,
}: {
  prefix: HomeThemePrefix
  onPick: (to: string) => void
  web: boolean
}) {
  const popularTitle = web ? 'Популярные' : 'Попробуйте сегодня'
  const rowClass = `home-${prefix}-picks__row`
  const nameClass = `home-${prefix}-picks__name`
  const titleClass = `home-${prefix}-picks__title`
  const listClass = `home-${prefix}-picks__list`

  const popular = (
    <section
      className={`home-${prefix}-picks home-web-picks home-web-picks--popular`}
      aria-labelledby={`home-${prefix}-picks-title`}
    >
      <div className="home-web-picks__head">
        <h2 id={`home-${prefix}-picks-title`} className={titleClass}>
          {popularTitle}
        </h2>
        {web ? (
          <Link to="/games" className="home-web-picks__more" onClick={() => haptic('light')}>
            Весь каталог
          </Link>
        ) : null}
      </div>
      <ul className={`${listClass} home-web-picks__list`}>
        {HOME_PICKS.map(({ title, image, avif, to }) => (
          <li key={title}>
            <button type="button" className={`${rowClass} home-web-picks__card`} onClick={() => onPick(to)}>
              <span className="home-picks__thumb-wrap" aria-hidden>
                <HomePickThumb image={image} avif={avif} />
              </span>
              <span className={`${nameClass} home-web-picks__name`}>{title}</span>
              <span className="home-picks__play" aria-hidden>
                <HomePlayIcon size="picks" />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )

  if (!web) return popular

  return (
    <>
      {popular}
      <section
        className={`home-${prefix}-picks home-web-picks home-web-picks--new`}
        aria-labelledby={`home-${prefix}-new-title`}
      >
        <div className="home-web-picks__head">
          <h2 id={`home-${prefix}-new-title`} className={titleClass}>
            Новые игры
          </h2>
          <Link to="/games" className="home-web-picks__more" onClick={() => haptic('light')}>
            Смотреть все
          </Link>
        </div>
        <ul className={`${listClass} home-web-picks__list`}>
          {HOME_NEW_PICKS.map(({ title, image, avif, to }) => (
            <li key={`new-${title}`}>
              <button type="button" className={`${rowClass} home-web-picks__card`} onClick={() => onPick(to)}>
                <span className="home-picks__thumb-wrap" aria-hidden>
                  <HomePickThumb image={image} avif={avif} />
                </span>
                <span className={`${nameClass} home-web-picks__name`}>{title}</span>
                <span className="home-picks__play" aria-hidden>
                  <HomePlayIcon size="picks" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

function HomeWebSide({ children }: { children: ReactNode }) {
  return <div className="home-web-side">{children}</div>
}

function Home() {
  const [theme] = useTheme()
  const isNeonDark = theme === 'neon-dark'
  const isNeonLight = theme === 'neon-light'
  const isSunset = theme === 'sunset'
  const isCalm = theme === 'minimal-calm'
  const web = isWebShell()
  const heroParallaxRef = useWebHeroParallax<HTMLDivElement>()
  const { isPremium, loading } = usePremium()
  const navigate = useNavigate()
  const [premiumOverlayOpen, setPremiumOverlayOpen] = useState(false)
  // Цена показывается только из ответа сервера, без зашитого значения.
  const [plansPriceLabel, setPlansPriceLabel] = useState('Тарифы')
  const favoritesLocked = isFavoritesLocked(isPremium)

  useEffect(() => {
    // Цена планов не блокирует первый экран: грузим после простоя / с небольшой задержкой.
    let cancelled = false
    const loadPlans = () => {
      apiGet<{ ok?: boolean; plans?: PlanOption[] }>('/api/plans')
        .then((res) => {
          if (cancelled) return
          if (res.ok && Array.isArray(res.plans)) {
            setPlansPriceLabel(formatPlansFromPrice(res.plans))
          }
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

  const handleFavoritesClick = useCallback(() => {
    haptic('light')
    if (favoritesLocked) {
      setPremiumOverlayOpen(true)
    } else {
      navigate('/favorites')
    }
  }, [favoritesLocked, navigate])

  const handlePremiumOpen = useCallback(() => {
    hapticImpact('light')
    setPremiumOverlayOpen(true)
  }, [])

  const handlePickClick = useCallback((to: string) => {
    haptic('light')
    navigate(to)
  }, [navigate])


  const legacyPremiumBlock = (!isPremium || loading) ? (
    <section className="home-premium-cta">
      <div className="premium-card-wrap">
        <button
          type="button"
          className="premium-card"
          onClick={handlePremiumOpen}
        >
          <div className="premium-card__left">
            <div className="premium-card__title-row">
              <span className="premium-card__title">Premium</span>
              <span className="premium-card__badge">PRO</span>
            </div>
            <div className="premium-card__sub">
              Открывает все игры и режимы • без автосписаний
            </div>
          </div>
          <div className="premium-card__right">
            <span className="premium-card__price-text">
              {loading ? 'Проверяем подписку…' : plansPriceLabel}
            </span>
            <span className="premium-card__arrow" aria-hidden>→</span>
          </div>
        </button>
      </div>
    </section>
  ) : null

  const themedPremiumBlock = (!isPremium || loading) ? (
    <HomePremiumBanner
      loading={loading}
      plansPriceLabel={plansPriceLabel}
      onOpen={handlePremiumOpen}
    />
  ) : null

  if (isCalm) {
    return (
      <div className={`home-page home-page--calm${web ? ' home-page--web' : ''}`}>
        <HomeWelcomeTop />
        {null}

        <div className="home-calm-themes">
          <ThemeToggle onPremiumRequired={() => setPremiumOverlayOpen(true)} />
        </div>

        <section className="home-calm-hero" aria-labelledby="home-calm-hero-title">
          <div className="home-calm-hero__card" ref={heroParallaxRef}>
            <img
              src={heroCalm}
              alt=""
              className="home-calm-hero__bg home-hero-parallax"
              decoding="async"
              loading="eager"
              {...HIGH_FETCH_PRIORITY}
            />
            <div className="home-calm-hero__shade" aria-hidden />
            <div className="home-calm-hero__content">
              <h1 id="home-calm-hero-title" className="home-calm-hero__title">
                <span className="home-calm-hero__title-line home-calm-hero__title-line--gradient">GameNight</span>
                <span className="home-calm-hero__title-line">Host</span>
              </h1>
              <p className="home-calm-hero__tagline">Твои игры. Твои правила.</p>
              <Link
                to="/games"
                className="home-calm-hero__cta"
                onClick={() => {
                  hapticImpact('light')
                  requestFullscreenOnUserGesture()
                }}
                onPointerEnter={() => { import('./Games') }}
              >
                <HomePlayIcon size="cta" />
                Начать игру
              </Link>
            </div>
          </div>
        </section>

        <HomeWebSide>
          <div className="home-calm-quick">
            <button
              type="button"
              className="home-calm-quick__card"
              onClick={handleFavoritesClick}
            >
              <span className="home-calm-quick__icon-wrap" aria-hidden>
                <img src={iconCalmFavorite} alt="" className="home-calm-quick__icon-img" decoding="async" />
              </span>
              <span className="home-calm-quick__text">
                <span className="home-calm-quick__label">Избранное</span>
                <span className="home-calm-quick__sub">Любимые игры</span>
              </span>
              <img src={iconCalmChevronRight} alt="" className="home-calm-quick__chev-img" decoding="async" />
            </button>
            <Link
              to="/profile"
              className="home-calm-quick__card home-calm-quick__card--link"
              onClick={() => haptic('light')}
            >
              <span className="home-calm-quick__icon-wrap home-calm-quick__icon-wrap--user" aria-hidden>
                <img src={iconCalmProfile} alt="" className="home-calm-quick__icon-img home-calm-quick__icon-img--user" decoding="async" />
              </span>
              <span className="home-calm-quick__text">
                <span className="home-calm-quick__label">Профиль</span>
                <span className="home-calm-quick__sub">Настройки</span>
              </span>
              <img src={iconCalmChevronRight} alt="" className="home-calm-quick__chev-img" decoding="async" />
            </Link>
          </div>
          {themedPremiumBlock}
        </HomeWebSide>

        <HomePicksSections prefix="calm" onPick={handlePickClick} web={web} />

        <PremiumOverlay isOpen={premiumOverlayOpen} onClose={() => setPremiumOverlayOpen(false)} />
      </div>
    )
  }

  if (isSunset) {
    return (
      <div className={`home-page home-page--sunset${web ? ' home-page--web' : ''}`}>
        <HomeWelcomeTop />
        {null}

        <div className="home-sunset-themes">
          <ThemeToggle onPremiumRequired={() => setPremiumOverlayOpen(true)} />
        </div>

        <section className="home-sunset-hero" aria-labelledby="home-sunset-hero-title">
          <div className="home-sunset-hero__card" ref={heroParallaxRef}>
            <img
              src={heroSunset}
              alt=""
              className="home-sunset-hero__bg home-hero-parallax"
              decoding="async"
              loading="eager"
              {...HIGH_FETCH_PRIORITY}
            />
            <div className="home-sunset-hero__shade" aria-hidden />
            <div className="home-sunset-hero__content">
              <h1 id="home-sunset-hero-title" className="home-sunset-hero__title">
                <span className="home-sunset-hero__title-line home-sunset-hero__title-line--gradient">GameNight</span>
                <span className="home-sunset-hero__title-line">Host</span>
              </h1>
              <p className="home-sunset-hero__tagline">Твои игры. Твои правила.</p>
              <Link
                to="/games"
                className="home-sunset-hero__cta"
                onClick={() => {
                  hapticImpact('light')
                  requestFullscreenOnUserGesture()
                }}
                onPointerEnter={() => { import('./Games') }}
              >
                <HomePlayIcon size="cta" />
                Начать игру
              </Link>
            </div>
          </div>
        </section>

        <HomeWebSide>
          <div className="home-sunset-quick">
            <button
              type="button"
              className="home-sunset-quick__card"
              onClick={handleFavoritesClick}
            >
              <span className="home-sunset-quick__icon-wrap" aria-hidden>
                <img src={iconSunsetFavorite} alt="" className="home-sunset-quick__icon-img" decoding="async" />
              </span>
              <span className="home-sunset-quick__text">
                <span className="home-sunset-quick__label">Избранное</span>
                <span className="home-sunset-quick__sub">Любимые игры</span>
              </span>
              <img src={iconSunsetChevronRight} alt="" className="home-sunset-quick__chev-img" decoding="async" />
            </button>
            <Link
              to="/profile"
              className="home-sunset-quick__card home-sunset-quick__card--link"
              onClick={() => haptic('light')}
            >
              <span className="home-sunset-quick__icon-wrap home-sunset-quick__icon-wrap--user" aria-hidden>
                <img src={iconSunsetProfile} alt="" className="home-sunset-quick__icon-img home-sunset-quick__icon-img--user" decoding="async" />
              </span>
              <span className="home-sunset-quick__text">
                <span className="home-sunset-quick__label">Профиль</span>
                <span className="home-sunset-quick__sub">Настройки</span>
              </span>
              <img src={iconSunsetChevronRight} alt="" className="home-sunset-quick__chev-img" decoding="async" />
            </Link>
          </div>
          {themedPremiumBlock}
        </HomeWebSide>

        <HomePicksSections prefix="sunset" onPick={handlePickClick} web={web} />

        <PremiumOverlay isOpen={premiumOverlayOpen} onClose={() => setPremiumOverlayOpen(false)} />
      </div>
    )
  }

  if (isNeonLight) {
    return (
      <div className={`home-page home-page--light${web ? ' home-page--web' : ''}`}>
        <HomeWelcomeTop />
        {null}

        <div className="home-light-themes">
          <ThemeToggle onPremiumRequired={() => setPremiumOverlayOpen(true)} />
        </div>

        <section className="home-light-hero" aria-labelledby="home-light-hero-title">
          <div className="home-light-hero__card" ref={heroParallaxRef}>
            <img
              src={lightHeroExact}
              alt=""
              className="home-light-hero__bg home-hero-parallax"
              decoding="async"
              loading="eager"
              {...HIGH_FETCH_PRIORITY}
            />
            <div className="home-light-hero__shade" aria-hidden />
            <div className="home-light-hero__content">
              <h1 id="home-light-hero-title" className="home-light-hero__title">
                <span className="home-light-hero__title-line home-light-hero__title-line--gradient">GameNight</span>
                <span className="home-light-hero__title-line">Host</span>
              </h1>
              <p className="home-light-hero__tagline">Твои игры. Твои правила.</p>
              <Link
                to="/games"
                className="home-light-hero__cta"
                onClick={() => {
                  hapticImpact('light')
                  requestFullscreenOnUserGesture()
                }}
                onPointerEnter={() => { import('./Games') }}
              >
                <HomePlayIcon size="cta" />
                Начать игру
              </Link>
            </div>
          </div>
        </section>

        <HomeWebSide>
          <div className="home-light-quick">
            <button
              type="button"
              className="home-light-quick__card"
              onClick={handleFavoritesClick}
            >
              <span className="home-light-quick__icon-wrap" aria-hidden>
                <img src={iconLightFavorite} alt="" className="home-light-quick__icon-img" decoding="async" />
              </span>
              <span className="home-light-quick__text">
                <span className="home-light-quick__label">Избранное</span>
                <span className="home-light-quick__sub">Любимые игры</span>
              </span>
              <img src={iconLightChevronRight} alt="" className="home-light-quick__chev-img" decoding="async" />
            </button>
            <Link
              to="/profile"
              className="home-light-quick__card home-light-quick__card--link"
              onClick={() => haptic('light')}
            >
              <span className="home-light-quick__icon-wrap home-light-quick__icon-wrap--user" aria-hidden>
                <img src={iconLightProfile} alt="" className="home-light-quick__icon-img home-light-quick__icon-img--user" decoding="async" />
              </span>
              <span className="home-light-quick__text">
                <span className="home-light-quick__label">Профиль</span>
                <span className="home-light-quick__sub">Настройки</span>
              </span>
              <img src={iconLightChevronRight} alt="" className="home-light-quick__chev-img" decoding="async" />
            </Link>
          </div>
          {themedPremiumBlock}
        </HomeWebSide>

        <HomePicksSections prefix="light" onPick={handlePickClick} web={web} />

        <PremiumOverlay isOpen={premiumOverlayOpen} onClose={() => setPremiumOverlayOpen(false)} />
      </div>
    )
  }

  if (isNeonDark) {
    return (
      <div className={`home-page home-page--neon${web ? ' home-page--web' : ''}`}>
        <HomeWelcomeTop />
        {null}

        <div className="home-neon-themes">
          <ThemeToggle onPremiumRequired={() => setPremiumOverlayOpen(true)} />
        </div>

        <section className="home-neon-hero" aria-labelledby="home-neon-hero-title">
          <div className="home-neon-hero__card" ref={heroParallaxRef}>
            <img
              src={heroPortal}
              alt=""
              className="home-neon-hero__bg home-hero-parallax"
              decoding="async"
              loading="eager"
              {...HIGH_FETCH_PRIORITY}
            />
            <div className="home-neon-hero__shade" aria-hidden />
            <div className="home-neon-hero__content">
              <h1 id="home-neon-hero-title" className="home-neon-hero__title">
                <span className="home-neon-hero__title-line home-neon-hero__title-line--gradient">GameNight</span>
                <span className="home-neon-hero__title-line">Host</span>
              </h1>
              <p className="home-neon-hero__tagline">Твои игры. Твои правила.</p>
              <Link
                to="/games"
                className="home-neon-hero__cta"
                onClick={() => {
                  hapticImpact('light')
                  requestFullscreenOnUserGesture()
                }}
                onPointerEnter={() => { import('./Games') }}
              >
                <HomePlayIcon size="cta" />
                Начать игру
              </Link>
            </div>
          </div>
        </section>

        <HomeWebSide>
          <div className="home-neon-quick">
            <button
              type="button"
              className="home-neon-quick__card"
              onClick={handleFavoritesClick}
            >
              <span className="home-neon-quick__icon-wrap" aria-hidden>
                <img src={iconFavoriteStar} alt="" className="home-neon-quick__icon-img" decoding="async" />
              </span>
              <span className="home-neon-quick__text">
                <span className="home-neon-quick__label">Избранное</span>
                <span className="home-neon-quick__sub">Любимые игры</span>
              </span>
              <img src={iconChevronRight} alt="" className="home-neon-quick__chev-img" decoding="async" />
            </button>
            <Link
              to="/profile"
              className="home-neon-quick__card home-neon-quick__card--link"
              onClick={() => haptic('light')}
            >
              <span className="home-neon-quick__icon-wrap home-neon-quick__icon-wrap--user" aria-hidden>
                <img src={iconProfileUser} alt="" className="home-neon-quick__icon-img home-neon-quick__icon-img--user" decoding="async" />
              </span>
              <span className="home-neon-quick__text">
                <span className="home-neon-quick__label">Профиль</span>
                <span className="home-neon-quick__sub">Настройки</span>
              </span>
              <img src={iconChevronRight} alt="" className="home-neon-quick__chev-img" decoding="async" />
            </Link>
          </div>
          {themedPremiumBlock}
        </HomeWebSide>

        <HomePicksSections prefix="neon" onPick={handlePickClick} web={web} />

        <PremiumOverlay isOpen={premiumOverlayOpen} onClose={() => setPremiumOverlayOpen(false)} />
      </div>
    )
  }

  return (
    <div className={`home-page${web ? ' home-page--web' : ''}`}>
      {null}
      <div className="home-page__top-row">
        <ThemeToggle onPremiumRequired={() => setPremiumOverlayOpen(true)} />
      </div>

      <section className="home-hero">
        <div className="home-hero__orb" aria-hidden />
        <div className="home-hero__content">
          <h1 className="home-hero__title">GameNight Host</h1>
          <div className="home-hero__actions">
            <Link
              to="/games"
              className="btn btn--primary home-hero__btn"
              onClick={() => {
                hapticImpact('light')
                requestFullscreenOnUserGesture()
              }}
              onPointerEnter={() => { import('./Games') }}
            >
              Начать игру
            </Link>
            <button
              type="button"
              className="btn btn--secondary home-hero__btn"
              onClick={handleFavoritesClick}
            >
              Моё избранное
            </button>
            <Link
              to="/profile"
              className="btn btn--secondary home-hero__btn"
              onClick={() => haptic('light')}
            >
              Профиль
            </Link>
          </div>
        </div>
      </section>

      {legacyPremiumBlock}

      <section className="home-about">
        <h2 className="home-about__subtitle">Игры для компании, пары и вечеринок</h2>
        <div className="home-about__chips">
          {APP_FEATURES.map((label) => (
            <span key={label} className="home-about__chip">
              {label}
            </span>
          ))}
        </div>
        <p className="home-about__text">
          Выбирай игру → настрой режим → играй.
        </p>
      </section>
      <PremiumOverlay isOpen={premiumOverlayOpen} onClose={() => setPremiumOverlayOpen(false)} />
    </div>
  )
}

export default Home
