function isDebug(): boolean {
  if (typeof window === 'undefined') return false
  if (import.meta.env.DEV) return true
  const search =
    window.location.search ||
    (window.location.hash.includes('?') ? '?' + window.location.hash.split('?')[1] : '')
  return new URLSearchParams(search).get('debug') === '1'
}

export function mark(name: string): void {
  if (isDebug() && typeof performance !== 'undefined' && performance.mark) {
    performance.mark(name)
  }
}

export function measure(name: string, start: string, end?: string): void {
  if (isDebug() && typeof performance !== 'undefined' && performance.measure) {
    try {
      performance.measure(name, start, end)
    } catch {
      // ignore
    }
  }
}
