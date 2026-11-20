import { useEffect, useRef } from 'react'
import { getTg } from '../utils/telegram'

/** Throttled: at most once per frame via RAF */
function useThrottledAppHeight() {
  const rafRef = useRef<number | null>(null)
  const pendingRef = useRef(false)

  const update = () => {
    if (typeof document === 'undefined') return
    const tg = getTg() as { viewportStableHeight?: number; viewportHeight?: number } | null
    const vv = typeof window !== 'undefined' ? window.visualViewport?.height ?? 0 : 0
    const client = document.documentElement?.clientHeight ?? 0
    const webFill = Math.max(window.innerHeight || 0, vv || 0, client || 0)
    const h =
      (typeof tg?.viewportStableHeight === 'number' && tg.viewportStableHeight > 0
        ? tg.viewportStableHeight
        : typeof tg?.viewportHeight === 'number' && tg.viewportHeight > 0
          ? tg.viewportHeight
          : webFill)
    document.documentElement.style.setProperty('--app-height', `${Math.round(h)}px`)
    if (tg) {
      document.documentElement.dataset.tgMobile = '1'
    } else {
      delete document.documentElement.dataset.tgMobile
    }
  }

  const schedule = () => {
    if (pendingRef.current) return
    pendingRef.current = true
    rafRef.current = requestAnimationFrame(() => {
      pendingRef.current = false
      rafRef.current = null
      update()
    })
  }

  useEffect(() => {
    update()
    window.addEventListener('resize', schedule)
    window.addEventListener('orientationchange', schedule)
    const vv = window.visualViewport
    vv?.addEventListener('resize', schedule)
    vv?.addEventListener('scroll', schedule)
    const tg = getTg()
    const onEvent = tg && (tg as { onEvent?: (e: string, fn: () => void) => void }).onEvent
    if (typeof onEvent === 'function') {
      onEvent('viewportChanged', schedule)
    }
    return () => {
      window.removeEventListener('resize', schedule)
      window.removeEventListener('orientationchange', schedule)
      vv?.removeEventListener('resize', schedule)
      vv?.removeEventListener('scroll', schedule)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])
}

export function useAppHeight() {
  useThrottledAppHeight()
}
