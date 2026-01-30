export function isDebug(): boolean {
  if (typeof window === 'undefined') return false
  if (import.meta.env.DEV) return true
  const search =
    window.location.search ||
    (window.location.hash.includes('?') ? '?' + window.location.hash.split('?')[1] : '')
  return new URLSearchParams(search).get('debug') === '1'
}

export function timeStart(label: string): void {
  if (isDebug() && typeof console !== 'undefined' && console.time) {
    console.time(label)
  }
}

export function timeEnd(label: string): void {
  if (isDebug() && typeof console !== 'undefined' && console.timeEnd) {
    console.timeEnd(label)
  }
}
