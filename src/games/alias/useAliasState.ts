import { useState, useCallback, useRef, useEffect } from 'react'
import type { AliasState } from './state'
import { loadAliasState, saveAliasState } from './state'

const DEBOUNCE_MS = 500

export function useAliasState(): [AliasState, (v: AliasState | ((prev: AliasState) => AliasState)) => void] {
  const [state, setStateInternal] = useState<AliasState>(() => loadAliasState())
  const pendingRef = useRef<AliasState | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = useCallback(() => {
    if (pendingRef.current !== null) {
      saveAliasState(pendingRef.current)
      pendingRef.current = null
    }
  }, [])

  useEffect(() => {
    const onHide = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      flush()
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('beforeunload', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('beforeunload', onHide)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      flush()
    }
  }, [flush])

  const setState = useCallback(
    (v: AliasState | ((prev: AliasState) => AliasState)) => {
      setStateInternal((prev) => {
        const next = typeof v === 'function' ? v(prev) : v
        pendingRef.current = next
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => {
          timeoutRef.current = null
          flush()
        }, DEBOUNCE_MS)
        return next
      })
    },
    [flush]
  )

  return [state, setState]
}
