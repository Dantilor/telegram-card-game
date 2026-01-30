import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useSyncPremium } from './hooks/useSyncPremium'
import { useAppHeight } from './hooks/useAppHeight'
import { readyAndExpand } from './utils/telegram'
import Home from './pages/Home'
import Decks from './pages/Decks'
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
        <Route path="/decks" element={<Decks />} />
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
