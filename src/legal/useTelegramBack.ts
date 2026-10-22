import { useEffect, useRef } from 'react'

type TelegramBack = {
  isVisible?: boolean
  show?: () => void
  hide?: () => void
  onClick?: (cb: () => void) => void
  offClick?: (cb: () => void) => void
}

const layers: Array<{ token: symbol; close: () => void }> = []
let back: TelegramBack | null = null
let wasVisible = false
const closeTop = () => layers[layers.length - 1]?.close()

/** One native handler: closing a document must not also dismiss its parent sheet. */
export function useTelegramBack(active: boolean, onClose: () => void): void {
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    if (!active) return
    const control = (window.Telegram?.WebApp as { BackButton?: TelegramBack } | undefined)?.BackButton
    if (!control?.show || !control.onClick) return
    const token = Symbol('legal-layer')
    if (layers.length === 0) {
      back = control
      wasVisible = Boolean(control.isVisible)
      back.onClick?.(closeTop)
    }
    layers.push({ token, close: () => close.current() })
    control.show()
    return () => {
      const index = layers.findIndex((layer) => layer.token === token)
      if (index >= 0) layers.splice(index, 1)
      if (layers.length === 0) {
        back?.offClick?.(closeTop)
        if (!wasVisible) back?.hide?.()
        back = null
      }
    }
  }, [active])
}
