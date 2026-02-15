import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { parseAndCacheFromHash } from './utils/telegramInitCache'
import { initTheme, type ThemeId } from './hooks/useTheme'
import { initTelegramUI, applyTelegramColorsRetry } from './lib/telegramTheme'
import './index.css'
import './styles/tg.css'
import App from './App.tsx'

let theme: ThemeId
try {
  theme = initTheme()
} catch {
  theme = 'neon-dark'
}

parseAndCacheFromHash()

try {
  initTelegramUI()
  applyTelegramColorsRetry(theme)
} catch {
  // no-op: вне Telegram / браузер
}

const rootEl = document.getElementById('root')!
createRoot(rootEl).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
