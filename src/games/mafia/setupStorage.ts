const STORAGE_KEY = 'MAFIA_SETUP_V1'

export const MAFIA_MIN_PLAYERS = 4
export const MAFIA_MAX_PLAYERS = 14

export type MafiaSetupDraft = {
  playerCount: number
  hostName: string
  playerNames: string[]
}

const defaultDraft: MafiaSetupDraft = {
  playerCount: MAFIA_MIN_PLAYERS,
  hostName: '',
  playerNames: [],
}

function clampPlayerCount(n: unknown): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return MAFIA_MIN_PLAYERS
  return Math.min(MAFIA_MAX_PLAYERS, Math.max(MAFIA_MIN_PLAYERS, Math.round(n)))
}

function isDefaultPlayerName(name: string): boolean {
  return /^Игрок \d+$/.test(name.trim())
}

/** Имена для полей ввода: пустые слоты вместо автоплейсхолдеров. */
export function namesForForm(stored: string[], count: number): string[] {
  const names = stored.slice(0, count).map((name) => {
    const trimmed = name.trim()
    if (!trimmed || isDefaultPlayerName(trimmed)) return ''
    return name
  })
  while (names.length < count) names.push('')
  return names
}

export function loadMafiaSetupDraft(): MafiaSetupDraft {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...defaultDraft }
    const parsed = JSON.parse(raw) as Partial<MafiaSetupDraft>
    const playerNames = Array.isArray(parsed.playerNames)
      ? parsed.playerNames.filter((n): n is string => typeof n === 'string')
      : []
    const fromNames = playerNames.length >= MAFIA_MIN_PLAYERS ? playerNames.length : MAFIA_MIN_PLAYERS
    const playerCount = clampPlayerCount(parsed.playerCount ?? fromNames)
    const hostName = typeof parsed.hostName === 'string' ? parsed.hostName : ''
    return {
      playerCount,
      hostName: hostName.trim() === 'Ведущий' ? '' : hostName,
      playerNames,
    }
  } catch {
    return { ...defaultDraft }
  }
}

export function saveMafiaSetupDraft(draft: MafiaSetupDraft): void {
  try {
    const playerCount = clampPlayerCount(draft.playerCount)
    const playerNames = draft.playerNames.slice(0, playerCount)
    while (playerNames.length < playerCount) playerNames.push('')
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        playerCount,
        hostName: draft.hostName,
        playerNames,
      } satisfies MafiaSetupDraft),
    )
  } catch {
    // ignore
  }
}

/** Сохранить состав после завершённой партии (перед сбросом). */
export function saveMafiaSetupFromGame(hostName: string, playerNames: string[]): void {
  if (playerNames.length < MAFIA_MIN_PLAYERS) return
  saveMafiaSetupDraft({
    playerCount: playerNames.length,
    hostName: hostName.trim() === 'Ведущий' ? '' : hostName,
    playerNames,
  })
}

export function readInitialMafiaSetupForm(): {
  count: number
  hostName: string
  names: string[]
} {
  const draft = loadMafiaSetupDraft()
  const count = draft.playerCount
  return {
    count,
    hostName: draft.hostName,
    names: namesForForm(draft.playerNames, count),
  }
}
