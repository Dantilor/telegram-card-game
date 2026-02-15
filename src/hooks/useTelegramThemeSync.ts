/**
 * Синхронизирует цвета Telegram WebApp (header, background) с текущей темой.
 * Вызывать в корневом компоненте (App).
 */
import { useEffect } from 'react'
import { useTheme } from './useTheme'
import { applyTelegramColorsRetry } from '../lib/telegramTheme'

/** При смене темы обновляет Telegram header/background. Retry — на некоторых клиентах срабатывает с задержкой. */
export function useTelegramThemeSync(): void {
  const [theme] = useTheme()

  useEffect(() => {
    applyTelegramColorsRetry(theme)
  }, [theme])
}
