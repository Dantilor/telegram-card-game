import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'tcg_theme'

export type ThemeId =
  | 'neon-dark'
  | 'neon-light'
  | 'portal'
  | 'soft-light'
  | 'sunset'
  | 'minimal-calm'

const THEMES: ThemeId[] = [
  'neon-dark',
  'neon-light',
  'portal',
  'soft-light',
  'sunset',
  'minimal-calm',
]

export const PREMIUM_THEMES: ThemeId[] = ['soft-light', 'sunset', 'minimal-calm']

function readStoredTheme(): ThemeId {
  if (typeof window === 'undefined') return 'neon-dark'
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeId | null
    if (stored && THEMES.includes(stored)) return stored
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

  const setTheme = useCallback((next: ThemeId) => {
    setThemeState(next)
  }, [])

  return [theme, setTheme]
}

/** Call before first paint to avoid flash (e.g. in main.tsx) */
export function initTheme(): ThemeId {
  const theme = readStoredTheme()
  applyTheme(theme)
  return theme
}
