import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { isWebShell } from '../config/shell'
import {
  getWebScrollSources,
  getWebScrollY,
  isImmersiveWebPath,
  scrollWebShellToTop,
} from '../lib/webChrome'

const HIDE_CLASS = 'gnh-web-nav--hidden'
const IMMERSIVE_CLASS = 'gnh-web-nav--immersive'

/**
 * WEB-only: scroll-to-top on route change, hide top header + bottom nav while
 * scrolling down and on immersive game paths. Does not run in Telegram Mini App.
 *
 * Listens on every possible scroll root + touch direction — some phones scroll
 * window/.app instead of .gnh-inside, so a single listener misses the gesture.
 */
export function useWebShellChrome(): void {
  const location = useLocation()
  const lastY = useRef(0)
  const touchY = useRef<number | null>(null)
  const ticking = useRef(false)

  useEffect(() => {
    if (!isWebShell()) return
    scrollWebShellToTop('auto')
  }, [location.pathname, location.search])

  useEffect(() => {
    if (!isWebShell()) return
    const html = document.documentElement
    const immersive = isImmersiveWebPath(location.pathname)
    html.classList.toggle(IMMERSIVE_CLASS, immersive)
    if (immersive) {
      html.classList.add(HIDE_CLASS)
      return () => {
        html.classList.remove(IMMERSIVE_CLASS)
      }
    }
    html.classList.remove(HIDE_CLASS)

    lastY.current = getWebScrollY()

    const applyScroll = (y: number) => {
      const delta = y - lastY.current
      if (y < 20) {
        html.classList.remove(HIDE_CLASS)
      } else if (delta > 4) {
        html.classList.add(HIDE_CLASS)
      } else if (delta < -4) {
        html.classList.remove(HIDE_CLASS)
      }
      lastY.current = y
    }

    const onScroll = () => {
      if (ticking.current) return
      ticking.current = true
      requestAnimationFrame(() => {
        ticking.current = false
        applyScroll(getWebScrollY())
      })
    }

    const onTouchStart = (event: TouchEvent) => {
      touchY.current = event.touches[0]?.clientY ?? null
    }

    const onTouchMove = (event: TouchEvent) => {
      const current = event.touches[0]?.clientY
      if (current == null || touchY.current == null) return
      const fingerDelta = touchY.current - current
      const y = getWebScrollY()
      // Finger up → content scrolls down → hide chrome
      if (fingerDelta > 10 && y > 20) {
        html.classList.add(HIDE_CLASS)
        lastY.current = y
      } else if (fingerDelta < -10) {
        html.classList.remove(HIDE_CLASS)
        lastY.current = y
      }
      touchY.current = current
    }

    const sources = getWebScrollSources()
    for (const source of sources) {
      source.addEventListener('scroll', onScroll, { passive: true })
    }
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })

    return () => {
      for (const source of sources) {
        source.removeEventListener('scroll', onScroll)
      }
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      html.classList.remove(IMMERSIVE_CLASS)
      html.classList.remove(HIDE_CLASS)
    }
  }, [location.pathname])
}
