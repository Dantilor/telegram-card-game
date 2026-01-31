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
