import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { initTheme } from './hooks/useTheme'
import './index.css'
import './styles/tg.css'
import App from './App.tsx'

try {
  initTheme()
} catch {
  // no-op: don't block render
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
