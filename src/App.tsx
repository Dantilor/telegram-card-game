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

function App() {
  console.log('[APP RENDER]', { location: window.location.href })

  useSyncPremium()
  useEffect(() => {
    try {
      readyAndExpand()
    } catch {
      // no-op: don't block UI
    }
  }, [])

  return (
    <div style={{ padding: 16, color: 'white' }}>
      <h1>APP FORCE RENDER</h1>
      <pre>{JSON.stringify({
        hasTelegram: !!(window as any).Telegram,
        initData: (window as any).Telegram?.WebApp?.initDataUnsafe,
        hash: window.location.hash,
      }, null, 2)}</pre>
    </div>
  )
}

export default App
