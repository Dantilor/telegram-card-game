import { useCallback, useEffect, useRef, useState } from 'react'
import { classifyLoadFailure, recoveryDelayMs } from '../lib/loadRecovery'

export type RecoveringStatus = 'idle' | 'loading' | 'ready' | 'recovering' | 'failed'

export type RecoveringResource<T> = {
  data: T | null
  status: RecoveringStatus
  error: unknown
  /** Epoch ms of the next scheduled automatic attempt, if any. */
  nextRetryAt: number | null
  /** Manual retry: restarts the schedule from the shortest pause. */
  retryNow: () => void
}

/**
 * Loads a read-only resource while `enabled`, and keeps recovering it after
 * transient failures (2, 4, 8, 15, 30 s…, honoring Retry-After) until it loads.
 *
 * - at most one request in flight;
 * - timers pause while the app is hidden and resume with an immediate check;
 * - `online` triggers an immediate check, but timers never depend on it;
 * - permanent failures (config, 400/401/403/404) stop until a manual retry;
 * - disabling or unmounting aborts the request and clears timers.
 *
 * Only for idempotent GETs. Never pass a payment or consent write here.
 */
export function useRecoveringResource<T>(
  enabled: boolean,
  load: (signal: AbortSignal) => Promise<T>,
  resetKey: unknown = 0
): RecoveringResource<T> {
  const [data, setData] = useState<T | null>(null)
  const [status, setStatus] = useState<RecoveringStatus>('idle')
  const [error, setError] = useState<unknown>(null)
  const [nextRetryAt, setNextRetryAt] = useState<number | null>(null)

  const loadRef = useRef(load)
  loadRef.current = load
  const controllerRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const failuresRef = useRef(0)
  const statusRef = useRef<RecoveringStatus>('idle')
  const activeRef = useRef(false)
  const dueRef = useRef(false)

  const setStatusBoth = useCallback((next: RecoveringStatus) => {
    statusRef.current = next
    setStatus(next)
  }, [])

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  const attemptRef = useRef<() => void>(() => undefined)

  const schedule = useCallback((delay: number) => {
    clearTimer()
    dueRef.current = true
    setNextRetryAt(Date.now() + delay)
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      attemptRef.current()
    }, delay)
  }, [clearTimer])

  const attempt = useCallback(() => {
    if (!activeRef.current || controllerRef.current) return
    clearTimer()
    dueRef.current = false
    setNextRetryAt(null)
    const controller = new AbortController()
    controllerRef.current = controller
    if (statusRef.current !== 'recovering') setStatusBoth('loading')
    loadRef.current(controller.signal).then(
      (value) => {
        if (controllerRef.current !== controller) return
        controllerRef.current = null
        failuresRef.current = 0
        setData(value)
        setError(null)
        setStatusBoth('ready')
      },
      (reason: unknown) => {
        if (controllerRef.current !== controller) return
        controllerRef.current = null
        setError(reason)
        const failure = classifyLoadFailure(reason)
        if (!failure.retryable) {
          setStatusBoth('failed')
          return
        }
        failuresRef.current += 1
        setStatusBoth('recovering')
        schedule(recoveryDelayMs(failuresRef.current, failure))
      }
    )
  }, [clearTimer, schedule, setStatusBoth])
  attemptRef.current = attempt

  const stop = useCallback(() => {
    activeRef.current = false
    clearTimer()
    dueRef.current = false
    controllerRef.current?.abort()
    controllerRef.current = null
  }, [clearTimer])

  useEffect(() => {
    if (!enabled) {
      stop()
      return
    }
    activeRef.current = true
    failuresRef.current = 0
    setData(null)
    setError(null)
    setNextRetryAt(null)
    setStatusBoth('loading')
    attempt()
    return stop
  }, [enabled, resetKey, attempt, stop, setStatusBoth])

  useEffect(() => {
    if (!enabled) return
    const checkNow = () => {
      if (!activeRef.current || controllerRef.current) return
      if (statusRef.current === 'recovering' || dueRef.current) attempt()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        // Keep the "retry due" flag, drop the timer while Telegram is in the background.
        clearTimer()
        return
      }
      checkNow()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('online', checkNow)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('online', checkNow)
    }
  }, [enabled, attempt, clearTimer])

  const retryNow = useCallback(() => {
    if (!activeRef.current || controllerRef.current) return
    failuresRef.current = 0
    setStatusBoth('loading')
    attempt()
  }, [attempt, setStatusBoth])

  return { data, status, error, nextRetryAt, retryNow }
}
