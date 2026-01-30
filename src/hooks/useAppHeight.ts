import { useEffect } from 'react'
import { getTg } from '../utils/telegram'

function setAppHeight() {
  if (typeof document === 'undefined') return
  const h = window.innerHeight
  document.documentElement.style.setProperty('--app-height', `${h}px`)
}

/** Sets --app-height CSS var, updates on resize and tg viewportChanged */
export function useAppHeight() {
  useEffect(() => {
    setAppHeight()
    window.addEventListener('resize', setAppHeight)
    const tg = getTg()
    const onEvent = tg && (tg as { onEvent?: (e: string, fn: () => void) => void }).onEvent
    if (typeof onEvent === 'function') {
      onEvent('viewportChanged', setAppHeight)
    }
    return () => {
      window.removeEventListener('resize', setAppHeight)
    }
  }, [])
}
