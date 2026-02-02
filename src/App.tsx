import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useSyncPremium } from './hooks/useSyncPremium'
import { useAppHeight } from './hooks/useAppHeight'
import { readyAndExpand } from './utils/telegram'
import Home from './pages/Home'
import Games from './pages/Games'
import CardGameEntry from './pages/CardGameEntry'
import GameStub from './pages/GameStub'
import Decks from './pages/Decks'
import ModePage from './pages/ModePage'
import MyDecks from './pages/MyDecks'
import Play from './pages/Play'
import AliasHome from './pages/AliasHome'
import AliasPlay from './pages/AliasPlay'
import AliasResult from './pages/AliasResult'
import CityEconomyHome from './pages/CityEconomyHome'
import CityEconomyPlay from './pages/CityEconomyPlay'
import CityEconomyResult from './pages/CityEconomyResult'
import ActivityHome from './pages/ActivityHome'
import ActivityPlay from './pages/ActivityPlay'
import ActivityResult from './pages/ActivityResult'
import MafiaLayout from './pages/MafiaLayout'
import SabotageLayout from './pages/SabotageLayout'
import MafiaSetup from './pages/MafiaSetup'
import MafiaRoles from './pages/MafiaRoles'
import MafiaNight from './pages/MafiaNight'
import MafiaDay from './pages/MafiaDay'
import MafiaVoting from './pages/MafiaVoting'
import MafiaResult from './pages/MafiaResult'
import SabotageSetup from './pages/SabotageSetup'
import SabotageRole from './pages/SabotageRole'
import SabotageTask from './pages/SabotageTask'
import SabotageVote from './pages/SabotageVote'
import SabotageResult from './pages/SabotageResult'
import QuizLayout from './pages/QuizLayout'
import QuizHome from './pages/QuizHome'
import QuizRoomSetup from './pages/QuizRoomSetup'
import QuizQuestion from './pages/QuizQuestion'
import QuizResult from './pages/QuizResult'
import QuizMiniSummary from './pages/QuizMiniSummary'
import QuizFinal from './pages/QuizFinal'
import TruthDareLayout from './pages/TruthDareLayout'
import TruthDareSetup from './pages/TruthDareSetup'
import TruthDareTurn from './pages/TruthDareTurn'
import TruthDareCard from './pages/TruthDareCard'
import TruthDareVote from './pages/TruthDareVote'
import TruthDareResult from './pages/TruthDareResult'
import CustomDeckEditor from './pages/CustomDeckEditor'
import Profile from './pages/Profile'
import { PlayErrorBoundary } from './components/PlayErrorBoundary'
import './App.css'

function App() {
  useAppHeight()
  useSyncPremium()
  useEffect(() => {
    try {
      readyAndExpand()
    } catch {
      // no-op: don't block UI
    }
  }, [])

  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/games" element={<Games />} />
        <Route path="/card" element={<CardGameEntry />} />
        <Route path="/game/:gameId" element={<GameStub />} />
        <Route path="/decks" element={<Decks />} />
        <Route path="/mode/:modeId" element={<ModePage />} />
        <Route path="/decks/custom" element={<MyDecks />} />
        <Route path="/decks/custom/new" element={<CustomDeckEditor />} />
        <Route path="/decks/custom/:id/edit" element={<CustomDeckEditor />} />
        <Route path="/alias" element={<AliasHome />} />
        <Route path="/alias/play" element={<AliasPlay />} />
        <Route path="/alias/result" element={<AliasResult />} />
        <Route path="/city-economy" element={<CityEconomyHome />} />
        <Route path="/city-economy/play" element={<CityEconomyPlay />} />
        <Route path="/city-economy/result" element={<CityEconomyResult />} />
        <Route path="/activity" element={<ActivityHome />} />
        <Route path="/activity/play" element={<ActivityPlay />} />
        <Route path="/activity/result" element={<ActivityResult />} />
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
          <Route path="room" element={<QuizRoomSetup />} />
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
        <Route
          path="/play/:deckId"
          element={
            <PlayErrorBoundary>
              <Play />
            </PlayErrorBoundary>
          }
        />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </div>
  )
}

export default App
