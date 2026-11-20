import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { isWebShell } from '../config/shell'
import { getWebScrollRoot, isImmersiveWebPath, scrollWebShellToTop } from '../lib/webChrome'

const HIDE_CLASS = 'gnh-web-nav--hidden'
const IMMERSIVE_CLASS = 'gnh-web-nav--immersive'

/**
 * WEB-only: scroll-to-top on route change, hide bottom nav while scrolling down
 * and on immersive game paths. Does not run in Telegram Mini App.
 */
export function useWebShellChrome(): void {
  const location = useLocation()
  const lastY = useRef(0)
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
    if (immersive) html.classList.add(HIDE_CLASS)
    else html.classList.remove(HIDE_CLASS)

    const root = getWebScrollRoot()
    if (!root || immersive) {
      return () => {
        html.classList.remove(IMMERSIVE_CLASS)
      }
    }

    lastY.current = root.scrollTop
    const onScroll = () => {
      if (ticking.current) return
      ticking.current = true
      requestAnimationFrame(() => {
        ticking.current = false
        const y = root.scrollTop
        const delta = y - lastY.current
        if (y < 24) {
          html.classList.remove(HIDE_CLASS)
        } else if (delta > 8) {
          html.classList.add(HIDE_CLASS)
        } else if (delta < -8) {
          html.classList.remove(HIDE_CLASS)
        }
        lastY.current = y
      })
    }
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      root.removeEventListener('scroll', onScroll)
      html.classList.remove(IMMERSIVE_CLASS)
      html.classList.remove(HIDE_CLASS)
    }
  }, [location.pathname])
}