import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { parseAndCacheFromHash } from './utils/telegramInitCache'
import { initTheme, type ThemeId } from './hooks/useTheme'
import { initTelegramUI, applyTelegramColorsRetry } from './lib/telegramTheme'
import { preloadImages } from './utils/preloadImages'
import { PRELOAD_CRITICAL_URLS } from './assets/images'
import './index.css'
import './styles/tg.css'
import App from './App.tsx'

// Картинки предзагружаем после первого рендера, чтобы не конкурировать с JS
const schedulePreload = () => {
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(() => preloadImages(PRELOAD_CRITICAL_URLS), { timeout: 400 })
  } else {
    setTimeout(() => preloadImages(PRELOAD_CRITICAL_URLS), 100)
  }
}

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
requestAnimationFrame(() => schedulePreload())
