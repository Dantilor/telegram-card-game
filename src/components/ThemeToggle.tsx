import { flushSync } from 'react-dom'
import { useTheme, type ThemeId } from '../hooks/useTheme'
import { usePremium } from '../contexts/PremiumContext'
import { isThemeLocked } from '../lib/access'
import { haptic } from '../utils/telegram'
import { applyTelegramColorsRetry } from '../lib/telegramTheme'
import './ThemeToggle.css'

const OPTIONS: { id: ThemeId; label: string }[] = [
  { id: 'neon-dark', label: 'Neon' },
  { id: 'neon-light', label: 'Light' },
  { id: 'sunset', label: 'Sunset' },
  { id: 'minimal-calm', label: 'Calm' },
]

type ThemeToggleProps = {
  onPremiumRequired?: () => void
}

function ThemeToggle({ onPremiumRequired }: ThemeToggleProps) {
  const [theme, setTheme] = useTheme()
  const { isPremium } = usePremium()
  const locked = isThemeLocked(isPremium)

  const handleThemeClick = (id: ThemeId) => {
    if (theme === id) return
    haptic('light')
    if (locked) {
      onPremiumRequired?.()
      return
    }
    flushSync(() => {
      setTheme(id)
    })
    applyTelegramColorsRetry(id)
  }

  return (
    <div className="theme-toggle-wrap">
      <div className="theme-toggle" role="group" aria-label="Тема оформления">
        {OPTIONS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            data-theme-id={id}
            className={`theme-toggle__btn ${theme === id ? 'theme-toggle__btn--active' : ''} ${locked ? 'theme-toggle__btn--locked' : ''}`}
            onClick={() => handleThemeClick(id)}
            aria-pressed={theme === id}
            aria-label={locked ? `${label} (Premium)` : label}
            title={locked ? 'Выбор темы — Premium' : undefined}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default ThemeToggle
