// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'

const goals: Array<[string, unknown]> = []
const hits: string[] = []

vi.mock('./yandexMetrika', () => ({
  enableYandexMetrika: vi.fn(async () => true),
  disableYandexMetrika: vi.fn(),
  purgeMetrikaStorage: vi.fn(),
  hitYandexMetrika: vi.fn((path: string) => {
    hits.push(path)
  }),
  reachYandexGoal: vi.fn((goal: string, params?: unknown) => {
    goals.push([goal, params])
    return true
  }),
}))

import WebMetrikaBoot from './WebMetrikaBoot'

let go: (to: string) => void = () => undefined
function Nav() {
  const nav = useNavigate()
  go = (to) => nav(to)
  return null
}

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0))
  })
}

describe('WebMetrikaBoot goals', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_GNH_SHELL', 'web')
    vi.stubEnv('VITE_GNH_METRIKA_ENABLED', '1')
    localStorage.setItem('gnh_metrika_consent_v2', 'granted')
    sessionStorage.clear()
    goals.length = 0
    hits.length = 0
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    localStorage.clear()
  })

  it('counts game_open once per game entry and premium_view once per tab', async () => {
    render(
      <MemoryRouter initialEntries={['/games']}>
        <WebMetrikaBoot />
        <Nav />
      </MemoryRouter>,
    )
    await flush()
    act(() => go('/mafia'))
    await flush()
    act(() => go('/mafia/roles'))
    await flush()
    act(() => go('/mafia/night'))
    await flush()
    expect(goals.filter(([g]) => g === 'game_open')).toEqual([['game_open', { gameId: 'mafia' }]])

    act(() => go('/games'))
    await flush()
    act(() => go('/mafia'))
    await flush()
    expect(goals.filter(([g]) => g === 'game_open')).toHaveLength(2)

    act(() => go('/premium'))
    await flush()
    act(() => go('/games'))
    await flush()
    act(() => go('/premium'))
    await flush()
    expect(goals.filter(([g]) => g === 'premium_view')).toHaveLength(1)
    expect(hits).toContain('/mafia/roles')
  })
})