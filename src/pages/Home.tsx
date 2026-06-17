import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { haptic } from '../utils/telegram'
import { hapticImpact } from '../utils/haptics'
import { requestFullscreenOnUserGesture } from '../lib/telegramTheme'
import { usePremium } from '../contexts/PremiumContext'
import { isFavoritesLocked } from '../utils/access'
import { apiGet } from '../lib/api'
import { formatPlansFromPrice, type PlanOption } from '../utils/planLabel'
import { useTheme } from '../hooks/useTheme'
import ThemeToggle from '../components/ThemeToggle'
import HomeWelcomeTop from '../components/HomeWelcomeTop'
import HomePremiumBanner from '../components/HomePremiumBanner'
import PremiumOverlay from '../components/PremiumOverlay'
import { IMAGES } from '../assets/images'
import heroPortal from '../assets/home/neon/hero-portal.png'
import iconFavoriteStar from '../assets/icons/gnh/action-favorite-star.svg'
import iconProfileUser from '../assets/icons/gnh/action-profile-user.svg'
import iconChevronRight from '../assets/icons/gnh/chevron-right.svg'
import iconLightFavorite from '../assets/icons/gnh-light-pro/light-favorite-star-pro.svg'
import iconLightProfile from '../assets/icons/gnh-light-pro/light-profile-user-pro.svg'
import iconLightChevronRight from '../assets/icons/gnh-light-pro/light-chevron-right-pro.svg'
import lightHeroExact from '../assets/home/light-pixel/light_hero_exact.png'
import heroSunset from '../assets/home/sunset/hero-sunset.png'
import iconSunsetFavorite from '../assets/icons/gnh-sunset-pro/sunset-favorite-star-pro.svg'
import iconSunsetProfile from '../assets/icons/gnh-sunset-pro/sunset-profile-user-pro.svg'
import iconSunsetChevronRight from '../assets/icons/gnh-sunset-pro/sunset-chevron-right-pro.svg'
import heroCalm from '../assets/home/calm/hero-calm.png'
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
  { title: 'Фигня но бесплатно', image: IMAGES.freebieTrash.png, gameId: 'freebie-trash', to: '/freebie-trash' },
  { title: 'Переводчик фраз', image: IMAGES.phraseTranslator.png, gameId: 'phrase-translator', to: '/phrase-translator' },
  { title: 'Где мы?', image: IMAGES.russiaTravel.png, gameId: 'russia-travel', to: '/russia-travel' },
] as const

function HomePlayIcon({ size = 'picks' }: { size?: 'picks' | 'cta' }) {
  return (
    <span className={`home-play-btn home-play-btn--${size}`} aria-hidden>
      <span className="home-play-btn__triangle" />
    </span>
  )
}

function Home() {
  const [theme] = useTheme()
  const isNeonDark = theme === 'neon-dark'
  const isNeonLight = theme === 'neon-light'
  const isSunset = theme === 'sunset'
  const isCalm = theme === 'minimal-calm'
  const { isPremium, loading } = usePremium()
  const navigate = useNavigate()
  const [premiumOverlayOpen, setPremiumOverlayOpen] = useState(false)
  const [plansPriceLabel, setPlansPriceLabel] = useState('от 259 ₽')
  const favoritesLocked = isFavoritesLocked(isPremium)

  useEffect(() => {
    apiGet<{ ok?: boolean; plans?: PlanOption[] }>('/api/plans')
      .then((res) => {
        if (res.ok && Array.isArray(res.plans)) {
          setPlansPriceLabel(formatPlansFromPrice(res.plans))
        }
      })
      .catch(() => {})
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
      <div className="home-page home-page--calm">
        <HomeWelcomeTop />

        <div className="home-calm-themes">
          <ThemeToggle onPremiumRequired={() => setPremiumOverlayOpen(true)} />
        </div>

        <section className="home-calm-hero" aria-labelledby="home-calm-hero-title">
          <div className="home-calm-hero__card">
            <img
              src={heroCalm}
              alt=""
              className="home-calm-hero__bg"
              decoding="async"
              loading="eager"
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

        <section className="home-calm-picks" aria-labelledby="home-calm-picks-title">
          <h2 id="home-calm-picks-title" className="home-calm-picks__title">Попробуйте сегодня</h2>
          <ul className="home-calm-picks__list">
            {HOME_PICKS.map(({ title, image, to }) => (
              <li key={title}>
                <button
                  type="button"
                  className="home-calm-picks__row"
                  onClick={() => handlePickClick(to)}
                >
                  <span className="home-picks__thumb-wrap" aria-hidden>
                    <img src={image} alt="" className="home-picks__thumb" decoding="async" loading="lazy" />
                  </span>
                  <span className="home-calm-picks__name">{title}</span>
                  <span className="home-picks__play" aria-hidden>
                    <HomePlayIcon size="picks" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <PremiumOverlay isOpen={premiumOverlayOpen} onClose={() => setPremiumOverlayOpen(false)} />
      </div>
    )
  }

  if (isSunset) {
    return (
      <div className="home-page home-page--sunset">
        <HomeWelcomeTop />

        <div className="home-sunset-themes">
          <ThemeToggle onPremiumRequired={() => setPremiumOverlayOpen(true)} />
        </div>

        <section className="home-sunset-hero" aria-labelledby="home-sunset-hero-title">
          <div className="home-sunset-hero__card">
            <img
              src={heroSunset}
              alt=""
              className="home-sunset-hero__bg"
              decoding="async"
              loading="eager"
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

        <section className="home-sunset-picks" aria-labelledby="home-sunset-picks-title">
          <h2 id="home-sunset-picks-title" className="home-sunset-picks__title">Попробуйте сегодня</h2>
          <ul className="home-sunset-picks__list">
            {HOME_PICKS.map(({ title, image, to }) => (
              <li key={title}>
                <button
                  type="button"
                  className="home-sunset-picks__row"
                  onClick={() => handlePickClick(to)}
                >
                  <span className="home-picks__thumb-wrap" aria-hidden>
                    <img src={image} alt="" className="home-picks__thumb" decoding="async" loading="lazy" />
                  </span>
                  <span className="home-sunset-picks__name">{title}</span>
                  <span className="home-picks__play" aria-hidden>
                    <HomePlayIcon size="picks" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <PremiumOverlay isOpen={premiumOverlayOpen} onClose={() => setPremiumOverlayOpen(false)} />
      </div>
    )
  }

  if (isNeonLight) {
    return (
      <div className="home-page home-page--light">
        <HomeWelcomeTop />

        <div className="home-light-themes">
          <ThemeToggle onPremiumRequired={() => setPremiumOverlayOpen(true)} />
        </div>

        <section className="home-light-hero" aria-labelledby="home-light-hero-title">
          <div className="home-light-hero__card">
            <img
              src={lightHeroExact}
              alt=""
              className="home-light-hero__bg"
              decoding="async"
              loading="eager"
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

        <section className="home-light-picks" aria-labelledby="home-light-picks-title">
          <h2 id="home-light-picks-title" className="home-light-picks__title">Попробуйте сегодня</h2>
          <ul className="home-light-picks__list">
            {HOME_PICKS.map(({ title, image, to }) => (
              <li key={title}>
                <button
                  type="button"
                  className="home-light-picks__row"
                  onClick={() => handlePickClick(to)}
                >
                  <span className="home-picks__thumb-wrap" aria-hidden>
                    <img src={image} alt="" className="home-picks__thumb" decoding="async" loading="lazy" />
                  </span>
                  <span className="home-light-picks__name">{title}</span>
                  <span className="home-picks__play" aria-hidden>
                    <HomePlayIcon size="picks" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <PremiumOverlay isOpen={premiumOverlayOpen} onClose={() => setPremiumOverlayOpen(false)} />
      </div>
    )
  }

  if (isNeonDark) {
    return (
      <div className="home-page home-page--neon">
        <HomeWelcomeTop />

        <div className="home-neon-themes">
          <ThemeToggle onPremiumRequired={() => setPremiumOverlayOpen(true)} />
        </div>

        <section className="home-neon-hero" aria-labelledby="home-neon-hero-title">
          <div className="home-neon-hero__card">
            <img
              src={heroPortal}
              alt=""
              className="home-neon-hero__bg"
              decoding="async"
              loading="eager"
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

        <section className="home-neon-picks" aria-labelledby="home-neon-picks-title">
          <h2 id="home-neon-picks-title" className="home-neon-picks__title">Попробуйте сегодня</h2>
          <ul className="home-neon-picks__list">
            {HOME_PICKS.map(({ title, image, to }) => (
              <li key={title}>
                <button
                  type="button"
                  className="home-neon-picks__row"
                  onClick={() => handlePickClick(to)}
                >
                  <span className="home-picks__thumb-wrap" aria-hidden>
                    <img src={image} alt="" className="home-picks__thumb" decoding="async" loading="lazy" />
                  </span>
                  <span className="home-neon-picks__name">{title}</span>
                  <span className="home-picks__play" aria-hidden>
                    <HomePlayIcon size="picks" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <PremiumOverlay isOpen={premiumOverlayOpen} onClose={() => setPremiumOverlayOpen(false)} />
      </div>
    )
  }

  return (
    <div className="home-page">
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
