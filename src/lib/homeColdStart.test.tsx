/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

vi.mock('../contexts/PremiumContext', () => ({
  usePremium: () => ({
    isPremium: false,
    activeUntil: null,
    loading: false,
    authError: true,
    authError401: false,
    serverError503: false,
    refetch: () => undefined,
    refresh: async () => null,
    refreshPremium: async () => null,
  }),
  PremiumProvider: ({ children }: { children: ReactNode }) => children,
}))

vi.mock('../legal/LegalProvider', () => ({
  useLegal: () => ({
    records: null,
    status: 'anonymous',
    error: null,
    refreshRecords: async () => undefined,
    openDocument: () => undefined,
    postLegal: async () => ({}),
  }),
  LegalProvider: ({ children }: { children: ReactNode }) => children,
}))

vi.mock('../lib/api', () => ({
  apiGet: vi.fn(() => new Promise(() => undefined)),
}))

vi.mock('../hooks/useTheme', async () => {
  const actual = await vi.importActual<typeof import('../hooks/useTheme')>('../hooks/useTheme')
  return {
    ...actual,
    useTheme: () => ['neon-light', vi.fn()] as const,
  }
})

describe('Home cold start', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_URL', 'https://api.example.test')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('renders the home shell while a slow plans request is still pending', async () => {
    const Home = (await import('../pages/Home')).default
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Premium')).toBeTruthy()
    })
  })
})
