/** Generation token helpers for ignoring stale WEB session /auth responses. */

export type SessionApplyGate = {
  generation: number
  bump: () => number
  isCurrent: (token: number) => boolean
}

export function createSessionApplyGate(start = 0): SessionApplyGate {
  let generation = start
  return {
    get generation() {
      return generation
    },
    bump() {
      generation += 1
      return generation
    },
    isCurrent(token: number) {
      return token === generation
    },
  }
}

/**
 * Apply a fetch result only if the generation still matches.
 * Used so a refresh started before logout cannot restore the old session.
 */
export function applyIfCurrent<T>(
  gate: SessionApplyGate,
  token: number,
  value: T,
  apply: (value: T) => void
): boolean {
  if (!gate.isCurrent(token)) return false
  apply(value)
  return true
}
