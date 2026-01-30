import { useState, useCallback, useRef, useEffect } from 'react'

const DEBOUNCE_MS = 600

export function useLocalState<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [state, setStateInternal] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw == null) return initial
      return JSON.parse(raw) as T
    } catch {
      return initial
    }
  })

  const pendingRef = useRef<T | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flushToStorage = useCallback(() => {
    if (pendingRef.current !== null) {
      try {
        localStorage.setItem(key, JSON.stringify(pendingRef.current))
      } catch {
        // ignore
      }
      pendingRef.current = null
    }
  }, [key])

  useEffect(() => {
    const onHide = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      flushToStorage()
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('beforeunload', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('beforeunload', onHide)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      flushToStorage()
    }
  }, [flushToStorage])

  const setState = useCallback(
    (v: T | ((prev: T) => T)) => {
      setStateInternal((prev) => {
        const next = typeof v === 'function' ? (v as (prev: T) => T)(prev) : v
        pendingRef.current = next
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => {
          timeoutRef.current = null
          flushToStorage()
        }, DEBOUNCE_MS)
        return next
      })
    },
    [flushToStorage]
  )

  return [state, setState]
}
