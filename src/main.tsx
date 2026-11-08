import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import { parseAndCacheFromHash } from './utils/telegramInitCache'
import { initTheme, type ThemeId } from './hooks/useTheme'
import { initTelegramUI, applyTelegramColorsRetry } from './lib/telegramTheme'
import { preloadImages } from './utils/preloadImages'
import { PRELOAD_CRITICAL_URLS } from './assets/images'
import { isWebShell } from './config/shell'
import './index.css'
import './styles/tg.css'
import App from './App.tsx'

preloadImages(PRELOAD_CRITICAL_URLS)

let theme: ThemeId
try {
  theme = initTheme()
} catch {
  theme = 'neon-light'
}

const web = isWebShell()

if (!web) {
  parseAndCacheFromHash()
  try {
    initTelegramUI()
    applyTelegramColorsRetry(theme)
  } catch {
    // no-op outside Telegram
  }
}

const Router = web ? BrowserRouter : HashRouter

const rootEl = document.getElementById('root')!
createRoot(rootEl).render(
  <StrictMode>
    <Router>
      <App />
    </Router>
  </StrictMode>,
)
