import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'tcg_theme'

export type ThemeId =
  | 'neon-dark'
  | 'neon-light'
  | 'portal'
  | 'sunset'
  | 'minimal-calm'

const THEMES: ThemeId[] = ['neon-dark', 'neon-light', 'portal', 'sunset', 'minimal-calm']

const SOFT_FALLBACK: ThemeId = 'neon-light'

function readStoredTheme(): ThemeId {
  if (typeof window === 'undefined') return 'neon-dark'
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as string | null
    if (stored === 'soft-light') return SOFT_FALLBACK
    if (stored && THEMES.includes(stored as ThemeId)) return stored as ThemeId
  } catch {
    // ignore
  }
  return 'neon-dark'
}

function applyTheme(theme: ThemeId): void {
  document.documentElement.dataset.theme = theme
}

export function useTheme(): [ThemeId, (theme: ThemeId) => void] {
  const [theme, setThemeState] = useState<ThemeId>(readStoredTheme)

  useEffect(() => {
    applyTheme(theme)
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // ignore
    }
  }, [theme])

  const setTheme = useCallback((next: ThemeId | string) => {
    const valid = next === 'soft-light' ? SOFT_FALLBACK : (THEMES.includes(next as ThemeId) ? (next as ThemeId) : 'neon-dark')
    setThemeState(valid)
  }, [])

  return [theme, setTheme]
}

/** Call before first paint to avoid flash (e.g. in main.tsx) */
export function initTheme(): ThemeId {
  const theme = readStoredTheme()
  applyTheme(theme)
  try {
    if (localStorage.getItem(STORAGE_KEY) === 'soft-light') {
      localStorage.setItem(STORAGE_KEY, SOFT_FALLBACK)
    }
  } catch {
    // ignore
  }
  return theme
}
