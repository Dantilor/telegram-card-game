import { useEffect, useRef } from 'react'
import {
  acquireGameSessionLease,
  notifyGameSessionLimitReached,
  releaseGameSessionLease,
} from '../lib/gameSessionLease'

/**
 * Hold one game-session lease while a play screen is mounted.
 * Re-acquire is idempotent (same clientLeaseId). Release on unmount.
 */
export function useHoldGameSessionLease(gameId: string, active = true) {
  const blockedRef = useRef(false)

  useEffect(() => {
    if (!active || !gameId || blockedRef.current) return
    let cancelled = false
    void (async () => {
      const result = await acquireGameSessionLease(gameId)
      if (cancelled) return
      if (!result.ok && result.limitReached) {
        blockedRef.current = true
        notifyGameSessionLimitReached()
      }
    })()
    return () => {
      cancelled = true
      void releaseGameSessionLease()
    }
  }, [gameId, active])
}