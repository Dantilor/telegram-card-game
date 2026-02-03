import { useTheme, type ThemeId } from '../hooks/useTheme'
import { haptic } from '../utils/telegram'
import './ThemeToggle.css'

const OPTIONS: { id: ThemeId; label: string }[] = [
  { id: 'neon-dark', label: 'Neon' },
  { id: 'neon-light', label: 'Light' },
  { id: 'portal', label: 'Portal' },
  { id: 'sunset', label: 'Sunset' },
  { id: 'minimal-calm', label: 'Calm' },
]

function ThemeToggle() {
  const [theme, setTheme] = useTheme()

  const handleThemeClick = (id: ThemeId) => {
    haptic('light')
    setTheme(id)
  }

  return (
    <div className="theme-toggle-wrap">
      <div className="theme-toggle" role="group" aria-label="Тема оформления">
        {OPTIONS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`theme-toggle__btn ${theme === id ? 'theme-toggle__btn--active' : ''}`}
            onClick={() => handleThemeClick(id)}
            aria-pressed={theme === id}
            aria-label={label}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default ThemeToggle
