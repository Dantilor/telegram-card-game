const STORAGE_KEY = 'TRUTH_DARE_SETTINGS_V1'

export type TDSettings = {
  lastPlayers: string[]
  lastTags: string[]
  lastSteps: number
}

const defaultSettings: TDSettings = {
  lastPlayers: [],
  lastTags: [],
  lastSteps: 20,
}

export function loadSettings(): TDSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...defaultSettings }
    const parsed = JSON.parse(raw) as Partial<TDSettings>
    return {
      lastPlayers: Array.isArray(parsed.lastPlayers) ? parsed.lastPlayers : [],
      lastTags: Array.isArray(parsed.lastTags) ? parsed.lastTags : [],
      lastSteps: typeof parsed.lastSteps === 'number' ? parsed.lastSteps : 20,
    }
  } catch {
    return { ...defaultSettings }
  }
}

export function saveSettings(s: TDSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    // ignore
  }
}
