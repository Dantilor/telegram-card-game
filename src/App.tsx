import { Routes, Route } from 'react-router-dom'
import { useSyncPremium } from './hooks/useSyncPremium'
import Home from './pages/Home'
import Decks from './pages/Decks'
import MyDecks from './pages/MyDecks'
import CustomDeckEditor from './pages/CustomDeckEditor'
import Play from './pages/Play'
import Profile from './pages/Profile'
import './App.css'

function App() {
  useSyncPremium()

  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/decks" element={<Decks />} />
        <Route path="/decks/custom" element={<MyDecks />} />
        <Route path="/decks/custom/new" element={<CustomDeckEditor />} />
        <Route path="/decks/custom/:id/edit" element={<CustomDeckEditor />} />
        <Route path="/play/:deckId" element={<Play />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </div>
  )
}

export default App
