/**
 * Интеграция с Telegram WebApp: header/background по теме.
 *
 * ИНСТРУКЦИЯ: где менять цвета тем
 * — Константа TELEGRAM_THEME_COLORS ниже. Для каждой темы заданы:
 *   - header: цвет верхней панели Telegram (должен совпадать с --bg0)
 *   - background: общий фон WebApp
 *   - bottomBar: опционально, нижняя панель
 * — Цвета должны совпадать с src/styles/theme.css (--bg0, --bg1).
 * — Если добавлена новая тема — добавить запись в TELEGRAM_THEME_COLORS
 *   и в ThemeId (hooks/useTheme.ts).
 */
import type { ThemeId } from '../hooks/useTheme'

export const TELEGRAM_THEME_COLORS: Record<
  ThemeId,
  { header: string; background: string; bottomBar?: string }
> = {
  'neon-dark': { header: '#070814', background: '#070814' },
  'neon-light': { header: '#e8e6f5', background: '#e8e6f5' },
  portal: { header: '#061410', background: '#061410' },
  sunset: { header: '#1c1917', background: '#1c1917' },
  'minimal-calm': { header: '#0f172a', background: '#0f172a' },
}

function getTg() {
  return (typeof window !== 'undefined' && (window as Window & { Telegram?: { WebApp?: {
    ready?: () => void
    expand?: () => void
    setHeaderColor?: (color: string) => void
    setBackgroundColor?: (color: string) => void
    setBottomBarColor?: (color: string) => void
  } } })?.Telegram?.WebApp) ?? null
}

/** ready() + expand(). Вызывать при старте приложения. */
export function initTelegramUI(): void {
  const tg = getTg()
  if (!tg) return
  try {
    tg.ready?.()
    tg.expand?.()
  } catch {
    // вне Telegram / браузер — игнорируем
  }
}

/** Применить цвета Telegram UI по themeId. Вызывать при смене темы и при первом рендере. */
export function applyTelegramColors(themeId: ThemeId): void {
  const tg = getTg()
  if (!tg) return
  const colors = TELEGRAM_THEME_COLORS[themeId] ?? TELEGRAM_THEME_COLORS['neon-dark']
  try {
    tg.setHeaderColor?.(colors.header)
    tg.setBackgroundColor?.(colors.background)
    if (colors.bottomBar) tg.setBottomBarColor?.(colors.bottomBar)
  } catch {
    // вне Telegram — игнорируем
  }
}
