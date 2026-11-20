import { useEffect, lazy, Suspense, useState, type ReactNode } from 'react'
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { useAppHeight } from './hooks/useAppHeight'
import { useWebShellChrome } from './hooks/useWebShellChrome'
import { useTelegramThemeSync } from './hooks/useTelegramThemeSync'
import { PremiumProvider } from './contexts/PremiumContext'
import { LegalProvider } from './legal/LegalProvider'
import { FirstUseSheet } from './components/LegalChoices'
import { readyAndExpand } from './utils/telegram'
import { scheduleIdleImports } from './utils/scheduleWhenIdle'
import { PlayErrorBoundary } from './components/PlayErrorBoundary'
import { isWebShell } from './config/shell'
import { getTelegramStartParam } from './lib/telegram'
import {
  GAME_SESSION_LIMIT_EVENT,
  isGameSessionHeld,
  releaseGameSessionLease,
  shouldReleaseLeaseOnPath,
} from './lib/gameSessionLease'
import GameSessionLimitModal from './components/GameSessionLimitModal'
import { WebAuthGate } from './shell/WebAuthGate'
import WebInstallBanner from './components/web/WebInstallBanner'
import './App.css'

const Home = lazy(() => import('./pages/Home'))
const WebInsideLayout = lazy(() => import('./shell/WebInsideLayout'))

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
const SledLayout = lazy(() => import('./pages/SledLayout'))
const MafiaShadowsLayout = lazy(() => import('./pages/MafiaShadowsLayout'))
const DoublesLayout = lazy(() => import('./pages/DoublesLayout'))
const InfectedLayout = lazy(() => import('./pages/InfectedLayout'))
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
const WebPremiumExperience = lazy(() => import('./pages/WebPremiumExperience'))
const WebPurchaseRecover = lazy(() => import('./pages/WebPurchaseRecover'))
const WebEmailConfirm = lazy(() => import('./pages/WebEmailConfirm'))
const WebTelegramLink = lazy(() => import('./pages/WebTelegramLink'))
const LegalDocumentPage = lazy(() => import('./pages/LegalDocumentPage'))

function DelayedFallback({ delayMs, children }: { delayMs: number; children: ReactNode }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const id = window.setTimeout(() => setShow(true), delayMs)
    return () => window.clearTimeout(id)
  }, [delayMs])

  if (!show) return null
  return <>{children}</>
}

function TelegramLinkStartRedirect() {
  const navigate = useNavigate()
  useEffect(() => {
    if (isWebShell()) return
    const param = getTelegramStartParam()
    if (!/^wl_[A-Za-z0-9_-]{16,60}$/.test(param)) return
    const hash = window.location.hash || ''
    if (hash.includes('/link-web')) return
    navigate('/link-web', { replace: true })
  }, [navigate])
  return null
}

/** Limit modal + release lease when returning to catalog/profile (no home-page API). */
function GameSessionLeaseHost() {
  const location = useLocation()
  const [limitOpen, setLimitOpen] = useState(false)

  useEffect(() => {
    const onLimit = () => setLimitOpen(true)
    window.addEventListener(GAME_SESSION_LIMIT_EVENT, onLimit)
    return () => window.removeEventListener(GAME_SESSION_LIMIT_EVENT, onLimit)
  }, [])

  useEffect(() => {
    if (!isGameSessionHeld()) return
    if (shouldReleaseLeaseOnPath(location.pathname)) {
      void releaseGameSessionLease()
    }
  }, [location.pathname])

  return (
    <GameSessionLimitModal
      open={limitOpen}
      onClose={() => setLimitOpen(false)}
      onRetry={() => setLimitOpen(false)}
    />
  )
}

function App() {
  const [isReady, setReady] = useState(false)
  useAppHeight()
  useWebShellChrome()
  useTelegramThemeSync()
  useEffect(() => {
    const raf = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(raf)
  }, [])
  useEffect(() => {
    if (!isWebShell()) {
      try {
        readyAndExpand()
      } catch {
        // no-op: don't block UI
      }
    }
    const fallbackT = setTimeout(() => {
      if (isWebShell()) return
      try {
        readyAndExpand()
      } catch {
        // no-op
      }
    }, 1800)

    // Warm only the next most likely screens — aggressive warming fought first interaction on 3G.
    const cancelRouteWarm = scheduleIdleImports(
      isWebShell()
        ? [
            () => import('./pages/Games'),
            () => import('./pages/Profile'),
            () => import('./pages/PremiumPage'),
          ]
        : [
            () => import('./pages/Games'),
            () => import('./pages/Profile'),
          ],
      {
        startDelayMs: isWebShell() ? 900 : 1200,
        gapMs: isWebShell() ? 350 : 500,
        timeoutMs: isWebShell() ? 2500 : 3500,
      }
    )

    // Обложки каталога грузит сама страница /games: на главной они забивали медленный канал.

    return () => {
      clearTimeout(fallbackT)
      cancelRouteWarm()
    }
  }, [])

  const routes = (
      <div className={`app${isReady ? ' is-ready' : ''}${isWebShell() ? ' app--web' : ''}`}>
        <TelegramLinkStartRedirect />
        <GameSessionLeaseHost />
        <Suspense
          fallback={
            <DelayedFallback delayMs={isWebShell() ? 120 : 250}>
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
        <Route path="/login" element={<Home />} />
        <Route element={<WebInsideLayout />}>
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
        <Route path="/sled" element={<SledLayout />} />
        <Route path="/mafia-shadows" element={<MafiaShadowsLayout />} />
        <Route path="/doubles" element={<DoublesLayout />} />
        <Route path="/infected" element={<InfectedLayout />} />
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
        <Route path="/wheel" element={<WebPremiumExperience initialView="wheel" />} />
        <Route path="/login" element={<WebPurchaseRecover />} />
        <Route path="/recover" element={<WebPurchaseRecover />} />
        <Route path="/email/confirm" element={<WebEmailConfirm />} />
        <Route path="/link-web" element={<WebTelegramLink />} />
        <Route path="/legal/documents/:documentId/versions/:version" element={<LegalDocumentPage />} />
        <Route path="/legal/documents/:documentId" element={<LegalDocumentPage />} />
        <Route path="/legal/privacy" element={<LegalDocumentPage documentId="privacy" />} />
        <Route path="/legal/terms" element={<LegalDocumentPage documentId="agreement" />} />
        <Route path="/legal/premium" element={<LegalDocumentPage documentId="offer" />} />
        </Route>
        </Routes>
        </Suspense>
      </div>
  )

  return (
    <PremiumProvider>
      <LegalProvider>
        {isWebShell() ? <WebAuthGate>{routes}</WebAuthGate> : routes}
        {isWebShell() ? <WebInstallBanner /> : null}
        <FirstUseSheet />
      </LegalProvider>
    </PremiumProvider>
  )
}

export default App
