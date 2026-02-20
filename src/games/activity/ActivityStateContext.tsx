import { createContext, useContext, useReducer, useEffect, useRef, type ReactNode } from 'react'
import type { ActivityState } from './types'
import { activityReducer, type ActivityAction } from './reducer'
import { loadActivityState, saveActivityState } from './state'

type ActivityContextValue = {
  state: ActivityState
  dispatch: (action: ActivityAction) => void
}

const ActivityStateContext = createContext<ActivityContextValue | null>(null)

const DEBOUNCE_MS = 300

export function ActivityProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(activityReducer, null, loadActivityState)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef<string>(JSON.stringify(state))

  useEffect(() => {
    const currentJson = JSON.stringify(state)
    if (currentJson === lastSavedRef.current) return

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveActivityState(state)
      lastSavedRef.current = currentJson
    }, DEBOUNCE_MS)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [state])

  return (
    <ActivityStateContext.Provider value={{ state, dispatch }}>
      {children}
    </ActivityStateContext.Provider>
  )
}

export function useActivityStateContext(): ActivityContextValue {
  const ctx = useContext(ActivityStateContext)
  if (!ctx) {
    throw new Error('useActivityStateContext must be used within ActivityProvider')
  }
  return ctx
}
