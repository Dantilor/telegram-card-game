import { useEffect, useRef } from 'react'
import { getTg } from '../utils/telegram'

/** Throttled: at most once per frame via RAF */
function useThrottledAppHeight() {
  const rafRef = useRef<number | null>(null)
  const pendingRef = useRef(false)

  const update = () => {
    if (typeof document === 'undefined') return
    const h = window.innerHeight
    document.documentElement.style.setProperty('--app-height', `${h}px`)
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
    const tg = getTg()
    const onEvent = tg && (tg as { onEvent?: (e: string, fn: () => void) => void }).onEvent
    if (typeof onEvent === 'function') {
      onEvent('viewportChanged', schedule)
    }
    return () => {
      window.removeEventListener('resize', schedule)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])
}

export function useAppHeight() {
  useThrottledAppHeight()
}
