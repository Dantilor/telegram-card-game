import type { AliasCategoryId } from './data/words'

export type AliasMode = 'solo' | 'team'

export type AliasState = {
  categoryId: AliasCategoryId | null
  timerSeconds: 30 | 45 | 60
  mode: AliasMode
  scores: { teamA: number; teamB: number }
  bag: string[]
  bagIdx: number
  lastPlayedTeam: 'A' | 'B' | null
}

const STORAGE_KEY = 'ALIAS_STATE_V1'

const defaultState: AliasState = {
  categoryId: null,
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
    const parsed = JSON.parse(raw) as Partial<AliasState>
    return {
      categoryId: parsed.categoryId ?? defaultState.categoryId,
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
