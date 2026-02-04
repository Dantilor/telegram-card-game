import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { parseAndCacheFromHash } from './utils/telegramInitCache'
import { initTheme } from './hooks/useTheme'
import { initTelegram } from './lib/telegram'
import './index.css'
import './styles/tg.css'
import App from './App.tsx'

try {
  initTheme()
} catch {
  // no-op: don't block render
}

parseAndCacheFromHash()

try {
  initTelegram()
} catch {
  // no-op: Telegram SDK may not be loaded
}

const rootEl = document.getElementById('root')!
createRoot(rootEl).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
