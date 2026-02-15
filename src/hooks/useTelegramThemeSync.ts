/**
 * Синхронизирует цвета Telegram WebApp (header, background) с текущей темой.
 * Вызывать в корневом компоненте (App).
 */
import { useEffect } from 'react'
import { useTheme } from './useTheme'
import { applyTelegramColors } from '../lib/telegramTheme'

/** При смене темы обновляет Telegram header/background. Применяет цвета и при первом рендере. */
export function useTelegramThemeSync(): void {
  const [theme] = useTheme()

  useEffect(() => {
    applyTelegramColors(theme)
  }, [theme])
}
