import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBack } from '../hooks/useBack'
import { usePremium } from '../contexts/PremiumContext'
import { COMIC_SERIES } from '../data/comics'
import { getComicCoverUrl } from '../lib/comicAssets'
import { isComicLocked } from '../lib/comicAccess'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
import PremiumOverlay from '../components/PremiumOverlay'
import GamesPageHeader from '../components/GamesPageHeader'
import CatalogTabs from '../components/CatalogTabs'
import SmartImage from '../components/SmartImage'
import './Games.css'
import './Comics.css'

function Comics() {
  const navigate = useNavigate()
  const handleBack = useBack('/')
  const { isPremium } = usePremium()
  const [premiumOverlayOpen, setPremiumOverlayOpen] = useState(false)

  const handleSeriesClick = (seriesId: string) => {
    hapticSelection()
    if (isComicLocked(seriesId, isPremium)) {
      setPremiumOverlayOpen(true)
      return
    }
    navigate(`/comics/${seriesId}`)
  }

  return (
    <div className="games-page comics-page">
      <div className="games-page__top">
        <HomeButton className="games-page__nav-btn" />
        <BackButton onClick={handleBack} className="games-page__nav-btn games-page__back" />
      </div>

      <GamesPageHeader tagline="что запускаем сегодня?" />
      <CatalogTabs active="comics" />

      <section className="comics-intro" aria-labelledby="comics-intro-title">
        <h2 id="comics-intro-title" className="comics-intro__title">
          Комиксы с Хостиком
        </h2>
        <p className="comics-intro__text">
          Истории GNH, которые можно листать прямо внутри приложения.
        </p>
      </section>

      <div className="games-grid comics-grid">
        {COMIC_SERIES.map((series, i) => {
          const locked = isComicLocked(series.id, isPremium)
          const cardClass = `games-grid__card games-grid__card--ready tile--active games-grid__card--image games-grid__card--glow-${i % 2 === 0 ? 'a' : 'b'} comics-grid__card${locked ? ' comics-grid__card--locked' : ''}`

          return (
            <button
              key={series.id}
              type="button"
              className={cardClass}
              style={{ animationDelay: `${i * 0.05}s` }}
              onClick={() => handleSeriesClick(series.id)}
              aria-label={locked ? `${series.title} (Premium)` : series.title}
            >
              <div
                className={`games-grid__card-image-wrap comics-grid__media${series.coverAspect === '3/4' ? ' comics-grid__media--34' : ''}`}
              >
                <SmartImage
                  src={getComicCoverUrl(series.id)}
                  alt=""
                  className="games-grid__card-img"
                  priority={i < 2}
                  aspectRatio=""
                  objectFit="contain"
                />
                {series.isNew && !locked ? (
                  <span className="games-card-badge games-card-badge--new comics-grid__badge--new">
                    Новое
                  </span>
                ) : null}
                {locked ? (
                  <>
                    <span className="games-card-badge games-card-badge--premium">Premium</span>
                    <span className="comics-grid__lock" aria-hidden>
                      <span className="comics-grid__lock-icon">✦</span>
                    </span>
                  </>
                ) : null}
              </div>
              <div className="games-grid__card-body comics-grid__body">
                <p className="comics-grid__kind">GNH-комикс</p>
                <h2 className="games-grid__title">{series.title}</h2>
                <p className="comics-grid__subtitle">{series.subtitle}</p>
                <p className="comics-grid__pages">{series.pagesCount} страниц</p>
                <span
                  className={`comics-grid__cta${locked ? ' comics-grid__cta--premium' : ''}`}
                  aria-hidden
                >
                  {locked ? 'Premium' : 'Открыть серию'}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      <PremiumOverlay isOpen={premiumOverlayOpen} onClose={() => setPremiumOverlayOpen(false)} />
    </div>
  )
}

export default Comics
