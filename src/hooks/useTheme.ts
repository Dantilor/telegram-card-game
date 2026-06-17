import { useCallback, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'tcg_theme'

export type ThemeId =
  | 'neon-dark'
  | 'neon-light'
  | 'sunset'
  | 'minimal-calm'

const THEMES: ThemeId[] = ['neon-light', 'neon-dark', 'sunset', 'minimal-calm']

const DEFAULT_THEME: ThemeId = 'neon-light'
const SOFT_FALLBACK: ThemeId = 'neon-light'

function readStoredTheme(): ThemeId {
  if (typeof window === 'undefined') return DEFAULT_THEME
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as string | null
    if (stored === 'soft-light') return SOFT_FALLBACK
    if (stored === 'portal') return 'neon-dark'
    if (stored && THEMES.includes(stored as ThemeId)) return stored as ThemeId
  } catch {
    // ignore
  }
  return DEFAULT_THEME
}

function applyTheme(theme: ThemeId): void {
  document.documentElement.dataset.theme = theme
}

function normalizeTheme(next: ThemeId | string): ThemeId {
  if (next === 'soft-light') return SOFT_FALLBACK
  if (next === 'portal') return 'neon-dark'
  return THEMES.includes(next as ThemeId) ? (next as ThemeId) : DEFAULT_THEME
}

let themeState: ThemeId = typeof window === 'undefined' ? DEFAULT_THEME : readStoredTheme()
const listeners = new Set<() => void>()

function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getThemeSnapshot(): ThemeId {
  return themeState
}

function persistTheme(theme: ThemeId): void {
  applyTheme(theme)
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // ignore
  }
}

function setGlobalTheme(next: ThemeId): void {
  if (themeState === next) return
  themeState = next
  persistTheme(next)
  listeners.forEach((listener) => listener())
}

export function useTheme(): [ThemeId, (theme: ThemeId | string) => void] {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, () => DEFAULT_THEME)

  const setTheme = useCallback((next: ThemeId | string) => {
    setGlobalTheme(normalizeTheme(next))
  }, [])

  return [theme, setTheme]
}

/** Call before first paint to avoid flash (e.g. in main.tsx) */
export function initTheme(): ThemeId {
  const theme = readStoredTheme()
  themeState = theme
  persistTheme(theme)
  try {
    if (localStorage.getItem(STORAGE_KEY) === 'soft-light') {
      localStorage.setItem(STORAGE_KEY, SOFT_FALLBACK)
    }
  } catch {
    // ignore
  }
  return theme
}
