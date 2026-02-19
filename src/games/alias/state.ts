import type { AliasCategoryId } from './data/words'
import type { AliasState, AliasTeamSlot, AliasMode } from './types'

const STORAGE_KEY = 'ALIAS_STATE_V3'

function defaultTeamSlots(): AliasTeamSlot[] {
  return Array.from({ length: 6 }, () => ({
    name: '',
    players: [],
    activePlayerIndex: 0,
  }))
}

const defaultState: AliasState = {
  categoryIds: [],
  timerSeconds: 45,
  mode: 'team',
  scores: { teamA: 0, teamB: 0 },
  bag: [],
  bagIdx: 0,
  lastPlayedTeam: null,
  teams: defaultTeamSlots(),
  teamCount: 2,
  phase: 'setup',
  currentTeamIndex: 0,
  activeTeamSlots: [],
  teamScores: [0, 0, 0, 0, 0, 0],
  roundEndsAt: null,
  guessed: 0,
  skipped: 0,
  roundEndFired: false,
}

function parseTeams(raw: unknown): AliasTeamSlot[] {
  if (!Array.isArray(raw) || raw.length !== 6) return defaultTeamSlots()
  return raw.map((item) => {
    if (item && typeof item === 'object' && 'name' in item && 'players' in item && 'activePlayerIndex' in item) {
      const o = item as Record<string, unknown>
      return {
        name: typeof o.name === 'string' ? o.name : '',
        players: Array.isArray(o.players) ? o.players.filter((p): p is string => typeof p === 'string') : [],
        activePlayerIndex: typeof o.activePlayerIndex === 'number' && o.activePlayerIndex >= 0 ? o.activePlayerIndex : 0,
      }
    }
    return { name: '', players: [], activePlayerIndex: 0 }
  })
}

export function loadAliasState(): AliasState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...defaultState }
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const categoryIds = Array.isArray(parsed.categoryIds)
      ? (parsed.categoryIds as AliasCategoryId[])
      : parsed.categoryId != null
        ? [parsed.categoryId as AliasCategoryId]
        : defaultState.categoryIds
    const mode = parsed.mode === 'solo' || parsed.mode === 'team' ? parsed.mode : defaultState.mode
    const teams = parseTeams(parsed.teams)
    return {
      categoryIds,
      timerSeconds: parsed.timerSeconds === 30 || parsed.timerSeconds === 45 || parsed.timerSeconds === 60
        ? parsed.timerSeconds
        : defaultState.timerSeconds,
      mode,
      scores: { ...defaultState.scores, ...(parsed.scores as object) },
      bag: Array.isArray(parsed.bag) ? parsed.bag : defaultState.bag,
      bagIdx: typeof parsed.bagIdx === 'number' ? parsed.bagIdx : defaultState.bagIdx,
      lastPlayedTeam: parsed.lastPlayedTeam === 'A' || parsed.lastPlayedTeam === 'B' ? parsed.lastPlayedTeam : null,
      teams,
      teamCount:
        typeof parsed.teamCount === 'number' && parsed.teamCount >= 2 && parsed.teamCount <= 6
          ? parsed.teamCount
          : defaultState.teamCount,
      phase: parsed.phase === 'setup' || parsed.phase === 'turn_ready' || parsed.phase === 'in_round' || parsed.phase === 'round_results'
        ? parsed.phase
        : defaultState.phase,
      currentTeamIndex: typeof parsed.currentTeamIndex === 'number' ? Math.max(0, parsed.currentTeamIndex) : 0,
      activeTeamSlots: Array.isArray(parsed.activeTeamSlots)
        ? (parsed.activeTeamSlots as number[]).filter((i) => typeof i === 'number' && i >= 0 && i < 6)
        : [],
      teamScores: Array.isArray(parsed.teamScores) && parsed.teamScores.length === 6
        ? (parsed.teamScores as number[]).map((n) => (typeof n === 'number' && n >= 0 ? n : 0))
        : defaultState.teamScores,
      roundEndsAt: typeof parsed.roundEndsAt === 'number' ? parsed.roundEndsAt : null,
      guessed: typeof parsed.guessed === 'number' ? parsed.guessed : 0,
      skipped: typeof parsed.skipped === 'number' ? parsed.skipped : 0,
      roundEndFired: parsed.roundEndFired === true,
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

export type { AliasState, AliasMode, AliasTeamSlot }
