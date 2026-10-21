import { useEffect } from 'react'

type TelegramBack = {
  show?: () => void
  hide?: () => void
  onClick?: (cb: () => void) => void
  offClick?: (cb: () => void) => void
}

function telegramBack(): TelegramBack | null {
  const webApp = window.Telegram?.WebApp as { BackButton?: TelegramBack } | undefined
  return webApp?.BackButton ?? null
}

/** Closes the current legal layer with Telegram's BackButton when it exists. */
export function useTelegramBack(active: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!active) return
    const back = telegramBack()
    if (!back?.show || !back.onClick) return
    const handler = () => onClose()
    back.onClick(handler)
    back.show()
    return () => {
      back.offClick?.(handler)
      back.hide?.()
    }
  }, [active, onClose])
}
