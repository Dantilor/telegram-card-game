import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useSyncPremium } from './hooks/useSyncPremium'
import { readyAndExpand } from './utils/telegram'
import Home from './pages/Home'
import Decks from './pages/Decks'
import MyDecks from './pages/MyDecks'
import CustomDeckEditor from './pages/CustomDeckEditor'
import Play from './pages/Play'
import Profile from './pages/Profile'
import './App.css'

function isDebug(): boolean {
  if (typeof window === 'undefined') return false
  const search =
    window.location.search ||
    (window.location.hash.includes('?') ? '?' + window.location.hash.split('?')[1] : '')
  return new URLSearchParams(search).get('debug') === '1'
}

function App() {
  useSyncPremium()
  useEffect(() => {
    try {
      readyAndExpand()
    } catch {
      // no-op: don't block UI
    }
  }, [])

  const debug = isDebug()
  const tg = typeof window !== 'undefined' ? (window as any).Telegram : null

  return (
    <div className="app">
      {debug && (
        <div style={{ padding: 16, color: 'white', background: '#1a1a1a', fontSize: 12 }}>
          <h2>APP DEBUG</h2>
          <pre>{JSON.stringify({
            hasTelegram: !!tg,
            initDataPresent: !!tg?.WebApp?.initDataUnsafe,
            hash: window.location.hash,
            href: window.location.href,
          }, null, 2)}</pre>
        </div>
      )}
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
