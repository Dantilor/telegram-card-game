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

interface TgWebApp {
  ready?: () => void
  expand?: () => void
  requestFullscreen?: () => void
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  setBottomBarColor?: (color: string) => void
  disableVerticalSwipes?: () => void
  version?: string
}

function getTg(): TgWebApp | null {
  if (typeof window === 'undefined') return null
  return (window as Window & { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp ?? null
}

/** WebApp 6.0 не поддерживает setHeaderColor/setBackgroundColor/requestFullscreen — проверяем версию */
function tgSupportsColors(): boolean {
  const tg = getTg()
  if (!tg?.version) return false
  return parseFloat(tg.version) > 6
}

function applyDisableVerticalSwipes(): void {
  const tg = getTg()
  if (!tg?.disableVerticalSwipes) return
  try {
    tg.disableVerticalSwipes()
  } catch {
    // вне Telegram / браузер — игнорируем
  }
}

/** ready() + expand() + отключение смахивания вниз (закрытие только по кнопке «Закрыть»). */
export function initTelegramUI(): void {
  const tg = getTg()
  if (!tg) return
  const doExpand = () => {
    try {
      tg.ready?.()
      tg.expand?.()
      applyDisableVerticalSwipes()
    } catch {
      // вне Telegram / браузер — игнорируем
    }
  }
  doExpand()
  setTimeout(doExpand, 300)
  // При перезагрузке страницы WebApp может быть ещё не готов — повторяем, чтобы всегда было без смаха
  ;[100, 300, 600, 1000].forEach((ms) => setTimeout(applyDisableVerticalSwipes, ms))
}

/** Запросить fullscreen только по user gesture (клик). Вызывать из onClick. */
export function requestFullscreenOnUserGesture(): void {
  try {
    const tg = getTg()
    if (!tg?.requestFullscreen || !tgSupportsColors()) return
    tg.requestFullscreen()
  } catch {
    // тихий fail, не логируем
  }
}

/** Применить цвета Telegram UI по themeId. Вызывать при смене темы и при первом рендере. */
export function applyTelegramColors(themeId: ThemeId): void {
  const tg = getTg()
  if (!tg || !tgSupportsColors()) return
  const colors = TELEGRAM_THEME_COLORS[themeId] ?? TELEGRAM_THEME_COLORS['neon-dark']
  try {
    tg.setHeaderColor?.(colors.header)
    tg.setBackgroundColor?.(colors.background)
    if (colors.bottomBar) tg.setBottomBarColor?.(colors.bottomBar)
  } catch {
    // вне Telegram — игнорируем
  }
}

/** Повторное применение цветов (на некоторых клиентах срабатывает с задержкой) */
export function applyTelegramColorsRetry(themeId: ThemeId, delaysMs = [100, 500]): void {
  applyTelegramColors(themeId)
  delaysMs.forEach((d) => setTimeout(() => applyTelegramColors(themeId), d))
}
