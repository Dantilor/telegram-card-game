import { useEffect, lazy, Suspense, useState, type ReactNode } from 'react'
import { Routes, Route } from 'react-router-dom'
import { trackEvent } from './lib/analytics'
import { useAppHeight } from './hooks/useAppHeight'
import { useTelegramThemeSync } from './hooks/useTelegramThemeSync'
import { PremiumProvider } from './contexts/PremiumContext'
import { readyAndExpand } from './utils/telegram'
import { getMe } from './api/subscription'
import { preloadImages } from './utils/preloadImages'
import { PRELOAD_CRITICAL_URLS } from './assets/images'
import { PlayErrorBoundary } from './components/PlayErrorBoundary'
import './App.css'

// Главная загружается сразу (первый экран)
import Home from './pages/Home'

// Остальные — ленивая загрузка для быстрого старта
const Games = lazy(() => import('./pages/Games'))
const Comics = lazy(() => import('./pages/Comics'))
const ComicReader = lazy(() => import('./pages/ComicReader'))
const CardGameEntry = lazy(() => import('./pages/CardGameEntry'))
const GameStub = lazy(() => import('./pages/GameStub'))
const Decks = lazy(() => import('./pages/Decks'))
const ModePage = lazy(() => import('./pages/ModePage'))
const Favorites = lazy(() => import('./pages/Favorites'))
const Play = lazy(() => import('./pages/Play'))
const AliasLayout = lazy(() => import('./pages/AliasLayout'))
const ActivityLayout = lazy(() => import('./pages/ActivityLayout'))
const MafiaLayout = lazy(() => import('./pages/MafiaLayout'))
const SabotageLayout = lazy(() => import('./pages/SabotageLayout'))
const QuizLayout = lazy(() => import('./pages/QuizLayout'))
const TruthDareLayout = lazy(() => import('./pages/TruthDareLayout'))
const WhoIsWhoLayout = lazy(() => import('./pages/WhoIsWhoLayout'))
const PhraseTranslator = lazy(() => import('./pages/PhraseTranslator'))
const FreebieTrashLayout = lazy(() => import('./pages/FreebieTrashLayout'))
const RussiaTravel = lazy(() => import('./pages/RussiaTravel'))
const RussiaTravelPlay = lazy(() => import('./pages/RussiaTravelPlay'))
const CustomDeckEditor = lazy(() => import('./pages/CustomDeckEditor'))
const AliasHome = lazy(() => import('./pages/AliasHome'))
const AliasPlay = lazy(() => import('./pages/AliasPlay'))
const AliasResult = lazy(() => import('./pages/AliasResult'))
const ActivityHome = lazy(() => import('./pages/ActivityHome'))
const ActivityPlay = lazy(() => import('./pages/ActivityPlay'))
const ActivityResult = lazy(() => import('./pages/ActivityResult'))
const MafiaSetup = lazy(() => import('./pages/MafiaSetup'))
const MafiaRoles = lazy(() => import('./pages/MafiaRoles'))
const MafiaNight = lazy(() => import('./pages/MafiaNight'))
const MafiaDay = lazy(() => import('./pages/MafiaDay'))
const MafiaVoting = lazy(() => import('./pages/MafiaVoting'))
const MafiaResult = lazy(() => import('./pages/MafiaResult'))
const SabotageSetup = lazy(() => import('./pages/SabotageSetup'))
const SabotageRole = lazy(() => import('./pages/SabotageRole'))
const SabotageTask = lazy(() => import('./pages/SabotageTask'))
const SabotageVote = lazy(() => import('./pages/SabotageVote'))
const SabotageResult = lazy(() => import('./pages/SabotageResult'))
const QuizHome = lazy(() => import('./pages/QuizHome'))
const QuizQuestion = lazy(() => import('./pages/QuizQuestion'))
const QuizResult = lazy(() => import('./pages/QuizResult'))
const QuizMiniSummary = lazy(() => import('./pages/QuizMiniSummary'))
const QuizFinal = lazy(() => import('./pages/QuizFinal'))
const TruthDareSetup = lazy(() => import('./pages/TruthDareSetup'))
const TruthDareTurn = lazy(() => import('./pages/TruthDareTurn'))
const TruthDareCard = lazy(() => import('./pages/TruthDareCard'))
const TruthDareVote = lazy(() => import('./pages/TruthDareVote'))
const TruthDareResult = lazy(() => import('./pages/TruthDareResult'))
const Profile = lazy(() => import('./pages/Profile'))
const PremiumPage = lazy(() => import('./pages/PremiumPage'))
const LegalPrivacy = lazy(() => import('./pages/LegalPrivacy'))
const LegalTerms = lazy(() => import('./pages/LegalTerms'))
const LegalPremium = lazy(() => import('./pages/LegalPremium'))

function DelayedFallback({ delayMs, children }: { delayMs: number; children: ReactNode }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const id = window.setTimeout(() => setShow(true), delayMs)
    return () => window.clearTimeout(id)
  }, [delayMs])

  if (!show) return null
  return <>{children}</>
}

function App() {
  const [isReady, setReady] = useState(false)
  useAppHeight()
  useTelegramThemeSync()
  useEffect(() => {
    const raf = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(raf)
  }, [])
  useEffect(() => {
    try {
      readyAndExpand()
    } catch {
      // no-op: don't block UI
    }
    const fallbackT = setTimeout(() => {
      try {
        readyAndExpand()
      } catch {
        // no-op
      }
    }, 1800)
    trackEvent('app_open')
    // Prefetch профиля: getMe() с кэшем в subscription — usePremiumStatus не сделает повторный запрос
    const t0 = setTimeout(() => {
      getMe().catch(() => {})
    }, 150)
    // Предзагрузка изображений карточек/режимов (с кэшем в preloadImages)
    const t0img = setTimeout(() => preloadImages(PRELOAD_CRITICAL_URLS), 200)
    // Предзагрузка основных экранов и чанков игр — чтобы при первом запуске не подвисало
    const t1 = setTimeout(() => import('./pages/Games'), 300)
    const t2 = setTimeout(() => import('./pages/CardGameEntry'), 600)
    const t3 = setTimeout(() => import('./pages/Profile'), 900)
    const t4 = setTimeout(() => import('./pages/Decks'), 1200)
    const t5 = setTimeout(() => import('./pages/ModePage'), 1500)
    const t6 = setTimeout(() => import('./pages/Favorites'), 1800)
    const t7 = setTimeout(() => import('./pages/Play'), 2100)
    const gameChunks = [
      () => import('./pages/AliasLayout'),
      () => import('./pages/ActivityLayout'),
      () => import('./pages/MafiaLayout'),
      () => import('./pages/SabotageLayout'),
      () => import('./pages/QuizLayout'),
      () => import('./pages/TruthDareLayout'),
      () => import('./pages/WhoIsWhoLayout'),
      () => import('./pages/PhraseTranslator'),
      () => import('./pages/FreebieTrashLayout'),
      () => import('./pages/RussiaTravel'),
      () => import('./pages/RussiaTravelPlay'),
    ]
    const gameChunkTimers = gameChunks.map((fn, i) => setTimeout(fn, 400 + i * 80))
    return () => {
      clearTimeout(fallbackT)
      clearTimeout(t0)
      clearTimeout(t0img)
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
      clearTimeout(t5)
      clearTimeout(t6)
      clearTimeout(t7)
      gameChunkTimers.forEach(clearTimeout)
    }
  }, [])

  return (
    <PremiumProvider>
      <div className={`app${isReady ? ' is-ready' : ''}`}>
        <Suspense
          fallback={
            <DelayedFallback delayMs={250}>
              <div className="page-loading page-loading-skeleton" aria-busy="true">
                <ul className="page-loading-skeleton__grid">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <li key={i} className="page-loading-skeleton__card" aria-hidden />
                  ))}
                </ul>
              </div>
            </DelayedFallback>
          }
        >
        <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/games" element={<Games />} />
        <Route path="/comics" element={<Comics />} />
        <Route path="/comics/:seriesId" element={<ComicReader />} />
        <Route path="/card" element={<CardGameEntry />} />
        <Route path="/game/:gameId" element={<GameStub />} />
        <Route path="/decks" element={<Decks />} />
        <Route path="/mode/:modeId" element={<ModePage />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/decks/custom" element={<Favorites />} />
        <Route path="/decks/custom/new" element={<CustomDeckEditor />} />
        <Route path="/decks/custom/:id/edit" element={<CustomDeckEditor />} />
        <Route path="/alias" element={<AliasLayout />}>
          <Route index element={<AliasHome />} />
          <Route path="play" element={<AliasPlay />} />
          <Route path="result" element={<AliasResult />} />
        </Route>
        <Route path="/activity" element={<ActivityLayout />}>
          <Route index element={<ActivityHome />} />
          <Route path="play" element={<ActivityPlay />} />
          <Route path="result" element={<ActivityResult />} />
        </Route>
        <Route path="/mafia" element={<MafiaLayout />}>
          <Route index element={<MafiaSetup />} />
          <Route path="roles" element={<MafiaRoles />} />
          <Route path="night" element={<MafiaNight />} />
          <Route path="day" element={<MafiaDay />} />
          <Route path="voting" element={<MafiaVoting />} />
          <Route path="result" element={<MafiaResult />} />
        </Route>
        <Route path="/sabotage" element={<SabotageLayout />}>
          <Route index element={<SabotageSetup />} />
          <Route path="role" element={<SabotageRole />} />
          <Route path="task" element={<SabotageTask />} />
          <Route path="vote" element={<SabotageVote />} />
          <Route path="result" element={<SabotageResult />} />
        </Route>
        <Route path="/quiz" element={<QuizLayout />}>
          <Route index element={<QuizHome />} />
          <Route path="play" element={<QuizQuestion />} />
          <Route path="result" element={<QuizResult />} />
          <Route path="mini-summary" element={<QuizMiniSummary />} />
          <Route path="final" element={<QuizFinal />} />
        </Route>
        <Route path="/truth-dare" element={<TruthDareLayout />}>
          <Route index element={<TruthDareSetup />} />
          <Route path="turn" element={<TruthDareTurn />} />
          <Route path="card" element={<TruthDareCard />} />
          <Route path="vote" element={<TruthDareVote />} />
          <Route path="result" element={<TruthDareResult />} />
        </Route>
        <Route path="/who-is-who" element={<WhoIsWhoLayout />} />
        <Route path="/phrase-translator" element={<PhraseTranslator />} />
        <Route path="/freebie-trash" element={<FreebieTrashLayout />} />
        <Route path="/russia-travel" element={<RussiaTravel />} />
        <Route path="/russia-travel/play/:deckId" element={<RussiaTravelPlay />} />
        <Route
          path="/play/:deckId"
          element={
            <PlayErrorBoundary>
              <Play />
            </PlayErrorBoundary>
          }
        />
        <Route path="/profile" element={<Profile />} />
        <Route path="/premium" element={<PremiumPage />} />
        <Route path="/legal/privacy" element={<LegalPrivacy />} />
        <Route path="/legal/terms" element={<LegalTerms />} />
        <Route path="/legal/premium" element={<LegalPremium />} />
        </Routes>
        </Suspense>
      </div>
    </PremiumProvider>
  )
}

export default App
