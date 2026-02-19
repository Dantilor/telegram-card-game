import type { AliasCategoryId } from './data/words'

export type AliasMode = 'solo' | 'team'

export type AliasState = {
  categoryIds: AliasCategoryId[]
  timerSeconds: 30 | 45 | 60
  mode: AliasMode
  scores: { teamA: number; teamB: number }
  bag: string[]
  bagIdx: number
  lastPlayedTeam: 'A' | 'B' | null
}

const STORAGE_KEY = 'ALIAS_STATE_V2'

const defaultState: AliasState = {
  categoryIds: [],
  timerSeconds: 45,
  mode: 'solo',
  scores: { teamA: 0, teamB: 0 },
  bag: [],
  bagIdx: 0,
  lastPlayedTeam: null,
}

export function loadAliasState(): AliasState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...defaultState }
    const parsed = JSON.parse(raw) as Partial<AliasState & { categoryId?: AliasCategoryId | null }>
    const categoryIds = Array.isArray(parsed.categoryIds)
      ? parsed.categoryIds
      : parsed.categoryId != null
        ? [parsed.categoryId]
        : defaultState.categoryIds
    return {
      categoryIds,
      timerSeconds: parsed.timerSeconds ?? defaultState.timerSeconds,
      mode: parsed.mode ?? defaultState.mode,
      scores: { ...defaultState.scores, ...parsed.scores },
      bag: Array.isArray(parsed.bag) ? parsed.bag : defaultState.bag,
      bagIdx: typeof parsed.bagIdx === 'number' ? parsed.bagIdx : defaultState.bagIdx,
      lastPlayedTeam: parsed.lastPlayedTeam ?? defaultState.lastPlayedTeam,
    }
  } catch {
    return { ...defaultState }
  }
}

export function saveAliasState(state: AliasState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
}
