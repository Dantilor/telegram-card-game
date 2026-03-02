/**
 * Type-safe flatten: если вход не массив/итерируемое — возвращает пустой массив.
 * Используется для защиты от "t is not iterable" при spread/reduce в зависимостях.
 */
export function safeFlatten<T>(input: unknown): T[] {
  if (input == null) return []
  if (Array.isArray(input)) {
    const result: T[] = []
    for (const item of input) {
      if (Array.isArray(item)) {
        result.push(...(safeFlatten(item) as T[]))
      } else if (item != null) {
        result.push(item as T)
      }
    }
    return result
  }
  if (typeof (input as Iterable<unknown>)[Symbol.iterator] === 'function') {
    return Array.from(input as Iterable<T>)
  }
  return []
}

/** Безопасно получить массив из значения (массив, итерируемое или одиночное). */
export function toArray<T>(input: unknown): T[] {
  if (input == null) return []
  if (Array.isArray(input)) return input as T[]
  if (typeof (input as Iterable<unknown>)[Symbol.iterator] === 'function') {
    return Array.from(input as Iterable<T>)
  }
  return [input] as T[]
}
