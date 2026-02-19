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

/** Единый начальный стейт экрана Ассоциации. Не мутировать. */
export function getInitialAliasState(): AliasState {
  return {
    categoryIds: [],
    timerSeconds: 30,
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
}

/** Полный сброс: возвращает стейт как при первом открытии (настройки, команды, игра). */
export function resetAllAssociations(): AliasState {
  return getInitialAliasState()
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
    if (!raw) return getInitialAliasState()
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const initial = getInitialAliasState()
    const categoryIds = Array.isArray(parsed.categoryIds)
      ? (parsed.categoryIds as AliasCategoryId[])
      : parsed.categoryId != null
        ? [parsed.categoryId as AliasCategoryId]
        : initial.categoryIds
    const mode = parsed.mode === 'solo' || parsed.mode === 'team' ? parsed.mode : initial.mode
    const teams = parseTeams(parsed.teams)
    return {
      categoryIds,
      timerSeconds: parsed.timerSeconds === 30 || parsed.timerSeconds === 45 || parsed.timerSeconds === 60
        ? parsed.timerSeconds
        : initial.timerSeconds,
      mode,
      scores: { ...initial.scores, ...(parsed.scores as object) },
      bag: Array.isArray(parsed.bag) ? parsed.bag : initial.bag,
      bagIdx: typeof parsed.bagIdx === 'number' ? parsed.bagIdx : initial.bagIdx,
      lastPlayedTeam: parsed.lastPlayedTeam === 'A' || parsed.lastPlayedTeam === 'B' ? parsed.lastPlayedTeam : null,
      teams,
      teamCount: (() => {
        const v = parsed.teamCount
        if (typeof v === 'number' && v >= 2 && v <= 6) return v
        const n = typeof v === 'string' ? parseInt(v, 10) : NaN
        if (Number.isFinite(n) && n >= 2 && n <= 6) return n
        return initial.teamCount
      })(),
      phase: parsed.phase === 'setup' || parsed.phase === 'turn_ready' || parsed.phase === 'in_round' || parsed.phase === 'round_results'
        ? parsed.phase
        : initial.phase,
      currentTeamIndex: typeof parsed.currentTeamIndex === 'number' ? Math.max(0, parsed.currentTeamIndex) : 0,
      activeTeamSlots: Array.isArray(parsed.activeTeamSlots)
        ? (parsed.activeTeamSlots as number[]).filter((i) => typeof i === 'number' && i >= 0 && i < 6)
        : [],
      teamScores: Array.isArray(parsed.teamScores) && parsed.teamScores.length === 6
        ? (parsed.teamScores as number[]).map((n) => (typeof n === 'number' && n >= 0 ? n : 0))
        : initial.teamScores,
      roundEndsAt: typeof parsed.roundEndsAt === 'number' ? parsed.roundEndsAt : null,
      guessed: typeof parsed.guessed === 'number' ? parsed.guessed : 0,
      skipped: typeof parsed.skipped === 'number' ? parsed.skipped : 0,
      roundEndFired: parsed.roundEndFired === true,
    }
  } catch {
    return getInitialAliasState()
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
