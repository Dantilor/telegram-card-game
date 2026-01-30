declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string
        ready?: () => void
        expand?: () => void
        setHeaderColor?: (color: string) => void
        openInvoice?: (url: string, cb?: (status: string) => void) => void
        BackButton?: {
          show: () => void
          hide: () => void
          onClick: (cb: () => void) => void
        }
        HapticFeedback?: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy') => void
        }
        initDataUnsafe?: {
          user?: {
            first_name: string
            last_name?: string
            username?: string
            photo_url?: string
          }
        }
      }
    }
  }
}

export function getTg() {
  return (typeof window !== 'undefined' && (window as any)?.Telegram?.WebApp) ?? null
}

export function getTgUser() {
  return getTg()?.initDataUnsafe?.user ?? null
}

export function readyAndExpand() {
  const tg = getTg()
  if (tg) {
    tg.ready?.()
    tg.expand?.()
  }
}

export function haptic(type: 'light' | 'medium' | 'heavy' = 'light') {
  getTg()?.HapticFeedback?.impactOccurred?.(type)
}

export function setHeaderColor(color: string) {
  getTg()?.setHeaderColor?.(color)
}
