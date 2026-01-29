import { useState, useCallback } from 'react'

export function useLocalState<T>(key: string, initial: T): [T, (v: T) => void] {
  const [state, setStateInternal] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw == null) return initial
      return JSON.parse(raw) as T
    } catch {
      return initial
    }
  })

  const setState = useCallback(
    (v: T) => {
      setStateInternal(v)
      try {
        localStorage.setItem(key, JSON.stringify(v))
      } catch {
        // ignore
      }
    },
    [key]
  )

  return [state, setState]
}
