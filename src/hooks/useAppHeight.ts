import { useEffect, useRef } from 'react'
import { getTg } from '../utils/telegram'
import { isWebShell } from '../config/shell'

/** Throttled: at most once per frame via RAF */
function useThrottledAppHeight() {
  const rafRef = useRef<number | null>(null)
  const pendingRef = useRef(false)

  const update = () => {
    if (typeof document === 'undefined') return
    const tg = getTg() as { viewportStableHeight?: number; viewportHeight?: number } | null
    const vv = typeof window !== 'undefined' ? window.visualViewport?.height ?? 0 : 0
    const client = document.documentElement?.clientHeight ?? 0
    // WEB: use layout viewport only. Chasing visualViewport while the iOS keyboard is open
    // shrinks the shell and leaves a mauve band / clipped inputs above the keyboard.
    const webFill = isWebShell()
      ? Math.max(window.innerHeight || 0, client || 0)
      : Math.max(window.innerHeight || 0, vv || 0, client || 0)
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
    // WEB ignores visualViewport for height; still listen so Telegram Mini App stays correct.
    if (!isWebShell()) {
      vv?.addEventListener('resize', schedule)
      vv?.addEventListener('scroll', schedule)
    }
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

/** Keep focused fields visible inside the WEB scroll owner when the soft keyboard opens. */
function useWebKeyboardFocusScroll() {
  useEffect(() => {
    if (!isWebShell()) return

    const onFocusIn = (event: FocusEvent) => {
      const target = event.target
      if (!(target instanceof HTMLElement)) return
      if (!target.matches('input, textarea, select, [contenteditable="true"]')) return

      const scroller = document.querySelector('.app.app--web > .gnh-inside') as HTMLElement | null
      window.setTimeout(() => {
        try {
          target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' })
        } catch {
          target.scrollIntoView(true)
        }
        if (!scroller) return
        const rect = target.getBoundingClientRect()
        const viewH = window.visualViewport?.height ?? window.innerHeight
        if (rect.bottom > viewH - 24 || rect.top < 80) {
          const delta = rect.top - Math.max(96, viewH * 0.28)
          scroller.scrollTop += delta
        }
      }, 80)
    }

    document.addEventListener('focusin', onFocusIn)
    return () => document.removeEventListener('focusin', onFocusIn)
  }, [])
}

export function useAppHeight() {
  useThrottledAppHeight()
  useWebKeyboardFocusScroll()
}
