import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { readyAndExpand } from './utils/telegram'
import { initTheme } from './hooks/useTheme'
import './index.css'
import './styles/tg.css'
import App from './App.tsx'

initTheme()
readyAndExpand()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
