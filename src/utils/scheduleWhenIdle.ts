type IdleTask = () => void

function getTimerApi(): {
  setTimeout: (handler: () => void, timeout?: number) => number
  clearTimeout: (id: number) => void
  requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number
  cancelIdleCallback?: (id: number) => void
} {
  const root = typeof globalThis !== 'undefined' ? (globalThis as typeof globalThis & Window) : undefined
  return {
    setTimeout: (handler, timeout) => {
      const id = (root?.setTimeout ?? setTimeout)(handler, timeout)
      return id as unknown as number
    },
    clearTimeout: (id) => {
      ;(root?.clearTimeout ?? clearTimeout)(id)
    },
    requestIdleCallback:
      root && typeof root.requestIdleCallback === 'function'
        ? root.requestIdleCallback.bind(root)
        : undefined,
    cancelIdleCallback:
      root && typeof root.cancelIdleCallback === 'function'
        ? root.cancelIdleCallback.bind(root)
        : undefined,
  }
}

/**
 * Run work after the browser is idle (or after timeout).
 * Prefer this for warm-up that must not compete with first paint / input.
 */
export function scheduleWhenIdle(task: IdleTask, timeoutMs = 2500): () => void {
  const timers = getTimerApi()
  if (timers.requestIdleCallback) {
    const id = timers.requestIdleCallback(() => task(), { timeout: timeoutMs })
    return () => timers.cancelIdleCallback?.(id)
  }

  const id = timers.setTimeout(task, Math.min(timeoutMs, 1200))
  return () => timers.clearTimeout(id)
}

/** React 18 has no `fetchPriority` prop; the lowercase attribute reaches the DOM without a warning. */
export const HIGH_FETCH_PRIORITY = { fetchpriority: 'high' } as Record<string, string>

/**
 * Run `task` once the first-screen images marked high priority have loaded
 * (or failed), with a timeout, so optional downloads do not compete with them.
 */
export function afterCriticalImages(task: IdleTask, timeoutMs = 8000): () => void {
  let done = false
  const pending = Array.from(document.querySelectorAll<HTMLImageElement>('img[fetchpriority="high"]')).filter(
    (img) => !img.complete
  )
  const finish = () => {
    if (done) return
    done = true
    cleanup()
    task()
  }
  const onSettled = () => {
    if (pending.every((img) => img.complete)) finish()
  }
  const timer = window.setTimeout(finish, timeoutMs)
  function cleanup() {
    window.clearTimeout(timer)
    for (const img of pending) {
      img.removeEventListener('load', onSettled)
      img.removeEventListener('error', onSettled)
    }
  }
  for (const img of pending) {
    img.addEventListener('load', onSettled)
    img.addEventListener('error', onSettled)
  }
  if (!pending.length) window.setTimeout(finish, 0)
  return () => {
    done = true
    cleanup()
  }
}

/**
 * Sequentially warm dynamic imports during idle time so we do not open
 * many parallel network requests on slow mobile connections.
 */
export function scheduleIdleImports(
  importers: Array<() => Promise<unknown>>,
  options?: { startDelayMs?: number; gapMs?: number; timeoutMs?: number }
): () => void {
  const timers = getTimerApi()
  const startDelayMs = options?.startDelayMs ?? 800
  const gapMs = options?.gapMs ?? 350
  const timeoutMs = options?.timeoutMs ?? 4000
  let cancelled = false
  const timeoutIds: number[] = []
  let cancelIdle: (() => void) | null = null

  const runNext = (index: number) => {
    if (cancelled || index >= importers.length) return
    cancelIdle = scheduleWhenIdle(() => {
      if (cancelled) return
      void importers[index]().catch(() => {})
      const gapTimer = timers.setTimeout(() => runNext(index + 1), gapMs)
      timeoutIds.push(gapTimer)
    }, timeoutMs)
  }

  const startTimer = timers.setTimeout(() => runNext(0), startDelayMs)
  timeoutIds.push(startTimer)

  return () => {
    cancelled = true
    timeoutIds.forEach((id) => timers.clearTimeout(id))
    cancelIdle?.()
  }
}
