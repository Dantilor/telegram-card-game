import { useEffect, useRef } from 'react'
import { isWebShell } from '../config/shell'

/**
 * Light desktop parallax for WEB hero backgrounds. No-ops on mobile / reduced motion / Mini App.
 */
export function useWebHeroParallax<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    if (!isWebShell()) return
    const el = ref.current
    if (!el) return
    if (typeof window.matchMedia !== 'function') return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    const desktop = window.matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)')
    if (reduce.matches || !desktop.matches) return

    let frame = 0
    const onMove = (event: PointerEvent) => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        const rect = el.getBoundingClientRect()
        const midY = rect.top + rect.height / 2
        const delta = (event.clientY - midY) / Math.max(rect.height, 1)
        const y = Math.max(-10, Math.min(10, delta * 12))
        el.style.setProperty('--parallax-y', `${y.toFixed(2)}px`)
      })
    }

    const onLeave = () => {
      el.style.setProperty('--parallax-y', '0px')
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    el.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  return ref
}
