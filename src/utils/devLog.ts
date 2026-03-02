/** Логи только в dev. В проде — no-op. */
const isDev = import.meta.env.DEV

export function devLog(...args: unknown[]): void {
  if (isDev) console.log(...args)
}

export function devWarn(...args: unknown[]): void {
  if (isDev) console.warn(...args)
}
