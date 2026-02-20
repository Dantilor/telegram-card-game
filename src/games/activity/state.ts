import type { ActivityState, ActivityTeamSlot } from './types'

const LOCAL_KEY = 'ACTIVITY_STATE_V1'

function createEmptyTeamSlot(): ActivityTeamSlot {
  return { name: '', players: [] }
}

export function getInitialActivityState(): ActivityState {
  return {
    categoryIds: [],
    timerSeconds: 60,
    teams: Array.from({ length: 6 }, createEmptyTeamSlot),
    teamCount: 2,
    phase: 'setup',
    currentTeamIndex: 0,
    activeTeamSlots: [],
    teamScores: [0, 0, 0, 0, 0, 0],
    teamGuessed: [0, 0, 0, 0, 0, 0],
    roundEndsAt: null,
    guessed: 0,
    skipped: 0,
    roundEndFired: false,
    currentWord: '',
    currentTaskType: 'explain',
    usedWords: [],
    roundNumber: 1,
  }
}

export function loadActivityState(): ActivityState {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return getInitialActivityState()
    const parsed = JSON.parse(raw) as Partial<ActivityState>
    const initial = getInitialActivityState()
    return {
      ...initial,
      ...parsed,
      teams: Array.isArray(parsed.teams)
        ? parsed.teams.map((t, i) => ({
            name: t?.name ?? initial.teams[i]?.name ?? '',
            players: Array.isArray(t?.players) ? t.players : [],
          }))
        : initial.teams,
    }
  } catch {
    return getInitialActivityState()
  }
}

export function saveActivityState(state: ActivityState): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
}

export function resetAllActivity(): ActivityState {
  const state = getInitialActivityState()
  saveActivityState(state)
  return state
}
