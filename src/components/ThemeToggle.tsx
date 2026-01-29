import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTheme, PREMIUM_THEMES, type ThemeId } from '../hooks/useTheme'
import { haptic } from '../utils/telegram'
import './ThemeToggle.css'

const STORAGE_KEY = 'tcg_state'

function getPremium(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const data = JSON.parse(raw) as { premium?: boolean }
    return !!data.premium
  } catch {
    return false
  }
}

const OPTIONS: { id: ThemeId; label: string }[] = [
  { id: 'neon-dark', label: 'Neon' },
  { id: 'neon-light', label: 'Light' },
  { id: 'portal', label: 'Portal' },
  { id: 'soft-light', label: 'Soft' },
  { id: 'sunset', label: 'Sunset' },
  { id: 'minimal-calm', label: 'Calm' },
]

function ThemeToggle() {
  const [theme, setTheme] = useTheme()
  const [showThemePaywall, setShowThemePaywall] = useState(false)

  const handleThemeClick = (id: ThemeId) => {
    haptic('light')
    if (PREMIUM_THEMES.includes(id) && !getPremium()) {
      setShowThemePaywall(true)
      return
    }
    setShowThemePaywall(false)
    setTheme(id)
  }

  return (
    <div className="theme-toggle-wrap">
      <div className="theme-toggle" role="group" aria-label="Тема оформления">
        {OPTIONS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`theme-toggle__btn ${theme === id ? 'theme-toggle__btn--active' : ''} ${PREMIUM_THEMES.includes(id) ? 'theme-toggle__btn--premium' : ''}`}
            onClick={() => handleThemeClick(id)}
            aria-pressed={theme === id}
            aria-label={label}
          >
            {label}
          </button>
        ))}
      </div>
      {showThemePaywall && (
        <p className="theme-toggle__paywall">
          Тема по подписке. <Link to="/decks/custom" onClick={() => setShowThemePaywall(false)}>Оформить Premium</Link>
        </p>
      )}
    </div>
  )
}

export default ThemeToggle
