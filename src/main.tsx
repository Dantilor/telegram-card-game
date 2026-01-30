import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { parseAndCacheFromHash } from './utils/telegramInitCache'
import { initTheme } from './hooks/useTheme'
import './index.css'
import './styles/tg.css'
import App from './App.tsx'

try {
  initTheme()
} catch {
  // no-op: don't block render
}

parseAndCacheFromHash()

const rootEl = document.getElementById('root')!
createRoot(rootEl).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
