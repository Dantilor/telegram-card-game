import type { ClassValue } from './class-value'

export type { ClassValue }

export function cn(...inputs: ClassValue[]): string {
  return inputs
    .flatMap((value) => {
      if (!value) return []
      if (typeof value === 'string' || typeof value === 'number') return [String(value)]
      if (Array.isArray(value)) return [cn(...value)]
      if (typeof value === 'object') {
        return Object.entries(value)
          .filter(([, on]) => Boolean(on))
          .map(([key]) => key)
      }
      return []
    })
    .filter(Boolean)
    .join(' ')
}
