import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getComicSeriesById, COMIC_SERIES } from '../data/comics'
import { getComicPageUrl } from '../lib/comicAssets'
import { isComicLocked } from '../lib/comicAccess'
import { usePremium } from '../contexts/PremiumContext'
import { useBack } from '../hooks/useBack'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
import GamesPageHeader from '../components/GamesPageHeader'
import PremiumOverlay from '../components/PremiumOverlay'
import '../styles/GamePageShell.css'
import './Games.css'
import './ComicReader.css'

const SWIPE_THRESHOLD_PX = 50

function ComicReaderTopNav({ onBack }: { onBack: () => void }) {
  return (
    <div className="games-page__top">
      <HomeButton className="games-page__nav-btn" />
      <BackButton onClick={onBack} className="games-page__nav-btn games-page__back" />
    </div>
  )
}

function ComicReader() {
  const { seriesId = '' } = useParams()
  const navigate = useNavigate()
  const handleBackToComics = useBack('/comics')
  const { isPremium } = usePremium()

  const series = getComicSeriesById(seriesId)
  const locked = series ? isComicLocked(series.id, isPremium) : false

  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [premiumOverlayOpen, setPremiumOverlayOpen] = useState(false)

  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  const pageCount = series?.pagesCount ?? 0
  const isFirst = currentPageIndex === 0
  const isLast = pageCount > 0 && currentPageIndex >= pageCount - 1

  useEffect(() => {
    setCurrentPageIndex(0)
  }, [seriesId])

  useEffect(() => {
    setImageLoaded(false)
    setImageError(false)
  }, [currentPageIndex, series?.id])

  useEffect(() => {
    if (!series || locked) return
    const nextPageNumber = currentPageIndex + 2
    if (nextPageNumber <= series.pagesCount) {
      const img = new Image()
      img.src = getComicPageUrl(series.id, nextPageNumber)
    }
  }, [series, locked, currentPageIndex])

  const goPrev = useCallback(() => {
    if (!series || locked) return
    hapticSelection()
    if (currentPageIndex > 0) {
      setCurrentPageIndex((p) => p - 1)
      return
    }
    handleBackToComics()
  }, [series, locked, currentPageIndex, handleBackToComics])

  const goNext = useCallback(() => {
    if (!series || locked) return
    if (currentPageIndex >= series.pagesCount - 1) return
    hapticSelection()
    setCurrentPageIndex((p) => p + 1)
  }, [series, locked, currentPageIndex])

  const seriesIndex = COMIC_SERIES.findIndex((item) => item.id === seriesId)
  const nextSeries = seriesIndex >= 0 && seriesIndex < COMIC_SERIES.length - 1
    ? COMIC_SERIES[seriesIndex + 1]
    : null

  const goGames = useCallback(() => {
    hapticSelection()
    navigate('/games')
  }, [navigate])

  const goNextSeries = useCallback(() => {
    if (!nextSeries) {
      goGames()
      return
    }
    hapticSelection()
    if (isComicLocked(nextSeries.id, isPremium)) {
      setPremiumOverlayOpen(true)
      return
    }
    navigate(`/comics/${nextSeries.id}`)
  }, [nextSeries, goGames, isPremium, navigate])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    if (!touch) return
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }, [])

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = touchStartRef.current
      touchStartRef.current = null
      if (!start || !series || locked) return

      const touch = e.changedTouches[0]
      if (!touch) return

      const deltaX = touch.clientX - start.x
      const deltaY = touch.clientY - start.y

      if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return
      if (Math.abs(deltaX) < Math.abs(deltaY)) return

      if (deltaX < 0) {
        goNext()
      } else {
        goPrev()
      }
    },
    [series, locked, goNext, goPrev]
  )

  const openPremium = useCallback(() => {
    hapticSelection()
    setPremiumOverlayOpen(true)
  }, [])

  if (!series) {
    return (
      <div className="game-page games-page comic-reader-page comic-reader-page--empty">
        <ComicReaderTopNav onBack={handleBackToComics} />
        <div className="comic-reader__empty">
          <h1 className="comic-reader__empty-title">Комикс не найден</h1>
          <Link to="/comics" className="game-page__cta comic-reader__empty-cta">
            Вернуться к комиксам
          </Link>
        </div>
      </div>
    )
  }

  if (locked) {
    return (
      <div className="game-page games-page comic-reader-page comic-reader-page--locked">
        <ComicReaderTopNav onBack={handleBackToComics} />
        <header className="comic-reader__header">
          <GamesPageHeader title={series.title} tagline={series.subtitle} />
        </header>
        <div className="comic-reader__locked">
          <div className="comic-reader__locked-icon" aria-hidden>
            ✦
          </div>
          <h2 className="comic-reader__locked-title">Эта серия доступна в Premium</h2>
          <p className="comic-reader__locked-text">
            Открой все комиксы GNH, новые серии и закрытые истории с Хостиком.
          </p>
          <button type="button" className="game-page__cta comic-reader__locked-cta" onClick={openPremium}>
            Разблокировать Premium
          </button>
          <Link to="/comics" className="game-page__btn game-page__btn--secondary comic-reader__locked-back">
            Назад к комиксам
          </Link>
        </div>
        <PremiumOverlay isOpen={premiumOverlayOpen} onClose={() => setPremiumOverlayOpen(false)} />
      </div>
    )
  }

  const pageNumber = currentPageIndex + 1
  const pageSrc = getComicPageUrl(series.id, pageNumber)

  return (
    <div className={`game-page games-page comic-reader-page${isLast ? ' comic-reader-page--last' : ''}`}>
      <ComicReaderTopNav onBack={handleBackToComics} />
      <header className="comic-reader__header">
        <GamesPageHeader title={series.title} tagline={series.subtitle} />
        <p className="comic-reader__progress" aria-live="polite">
          {pageNumber} / {series.pagesCount}
        </p>
      </header>

      <div
        className="comic-reader__stage"
        aria-busy={!imageLoaded && !imageError}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="comic-reader__frame">
          {!imageLoaded && !imageError ? (
            <div className="comic-reader__skeleton" aria-hidden />
          ) : null}
          {imageError ? (
            <p className="comic-reader__error">Не удалось загрузить страницу.</p>
          ) : (
            <img
              key={`${series.id}-${pageNumber}`}
              src={pageSrc}
              alt={`${series.title}, страница ${pageNumber}`}
              className={`comic-reader__img ${imageLoaded ? 'comic-reader__img--loaded' : ''}`}
              loading="eager"
              decoding="async"
              draggable={false}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
          )}
        </div>
      </div>

      <p className="comic-reader__hint">Листай свайпом или кнопками</p>

      <footer className="comic-reader__footer">
        <div className="comic-reader__nav">
          <button
            type="button"
            className="game-page__btn game-page__btn--secondary comic-reader__nav-btn"
            onClick={goPrev}
          >
            {isFirst ? 'К комиксам' : 'Назад'}
          </button>
          {isLast ? (
            <button type="button" className="game-page__cta comic-reader__nav-btn" onClick={goNextSeries}>
              {nextSeries ? 'Следующая серия' : 'К играм'}
            </button>
          ) : (
            <button type="button" className="game-page__cta comic-reader__nav-btn" onClick={goNext}>
              Далее
            </button>
          )}
        </div>

        {isLast ? (
          <section className="comic-reader__outro" aria-labelledby="comic-reader-outro-title">
            <h2 id="comic-reader-outro-title" className="comic-reader__outro-title">
              Хочешь такой же вечер?
            </h2>
            <p className="comic-reader__outro-text">
              Открой игры GNH и запусти свою историю с друзьями.
            </p>
            <div className="comic-reader__outro-actions">
              <button type="button" className="game-page__cta comic-reader__outro-cta" onClick={goGames}>
                Открыть игры GNH
              </button>
              <Link to="/comics" className="game-page__btn game-page__btn--secondary comic-reader__outro-back">
                К комиксам
              </Link>
            </div>
          </section>
        ) : null}
      </footer>
    </div>
  )
}

export default ComicReader
