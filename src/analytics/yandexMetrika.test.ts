import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setMetrikaConsent, clearMetrikaConsent } from './metrikaConsent'
import {
  disableYandexMetrika,
  enableYandexMetrika,
  hitYandexMetrika,
  isMetrikaInitialized,
  loadYandexMetrika,
  reachYandexGoal,
  resetYandexMetrikaForTests,
} from './yandexMetrika'
import { METRIKA_COUNTER_ID, METRIKA_SCRIPT_URL } from './metrikaConfig'
import {
  markMetrikaPaymentPending,
  reportMetrikaPremiumPurchaseConfirmed,
  resetMetrikaGoalsForTests,
  mirrorTrackEventToMetrika,
} from './metrikaGoals'

describe('yandexMetrika consent gate', () => {
  beforeEach(() => {
    resetYandexMetrikaForTests()
    resetMetrikaGoalsForTests()
    clearMetrikaConsent()
    document.head.innerHTML = ''
    document.body.innerHTML = ''
  })

  afterEach(() => {
    resetYandexMetrikaForTests()
    resetMetrikaGoalsForTests()
    clearMetrikaConsent()
  })

  it('does not inject tag.js without consent', async () => {
    await loadYandexMetrika()
    expect(document.querySelector('script[data-gnh-metrika="1"]')).toBeNull()
    expect(isMetrikaInitialized()).toBe(false)
  })

  it('loads official tag.js once after grant and inits with defer + no webvisor', async () => {
    setMetrikaConsent('granted')
    const calls: unknown[][] = []
    window.ym = ((...args: unknown[]) => {
      calls.push(args)
    }) as typeof window.ym

    // Pretend script already present to avoid network
    const script = document.createElement('script')
    script.dataset.gnhMetrika = '1'
    document.head.appendChild(script)

    await enableYandexMetrika()
    expect(isMetrikaInitialized()).toBe(true)
    expect(calls[0]?.[0]).toBe(METRIKA_COUNTER_ID)
    expect(calls[0]?.[1]).toBe('init')
    const init = calls[0]?.[2] as Record<string, unknown>
    expect(init.defer).toBe(true)
    expect(init.webvisor).toBe(false)

    await enableYandexMetrika()
    expect(calls.filter((c) => c[1] === 'init')).toHaveLength(1)
  })

  it('sends a single SPA hit per path and reachGoal without secrets', async () => {
    setMetrikaConsent('granted')
    const calls: unknown[][] = []
    window.ym = ((...args: unknown[]) => {
      calls.push(args)
    }) as typeof window.ym
    const script = document.createElement('script')
    script.dataset.gnhMetrika = '1'
    document.head.appendChild(script)
    await enableYandexMetrika()

    hitYandexMetrika('/games')
    hitYandexMetrika('/games')
    hitYandexMetrika('/quiz')
    const hits = calls.filter((c) => c[1] === 'hit')
    expect(hits).toHaveLength(2)
    expect(String(hits[0]?.[2])).toContain('/games')
    expect(String(hits[0]?.[2])).not.toContain('token=')

    reachYandexGoal('game_start', { gameId: 'quiz', email: 'x@y.z' } as never)
    const goals = calls.filter((c) => c[1] === 'reachGoal')
    expect(goals[0]?.[2]).toBe('game_start')
    expect(goals[0]?.[3]).toEqual({ gameId: 'quiz' })
  })

  it('stops after deny and removes script', async () => {
    setMetrikaConsent('granted')
    const script = document.createElement('script')
    script.dataset.gnhMetrika = '1'
    script.src = METRIKA_SCRIPT_URL
    document.head.appendChild(script)
    await enableYandexMetrika()
    disableYandexMetrika()
    expect(document.querySelector('script[data-gnh-metrika="1"]')).toBeNull()
    expect(isMetrikaInitialized()).toBe(false)
  })

  it('does not count premium_purchase on return without pending checkout', async () => {
    setMetrikaConsent('granted')
    const calls: unknown[][] = []
    window.ym = ((...args: unknown[]) => {
      calls.push(args)
    }) as typeof window.ym
    const script = document.createElement('script')
    script.dataset.gnhMetrika = '1'
    document.head.appendChild(script)
    await enableYandexMetrika()

    await reportMetrikaPremiumPurchaseConfirmed()
    expect(calls.some((c) => c[1] === 'reachGoal' && c[2] === 'premium_purchase')).toBe(false)

    markMetrikaPaymentPending()
    await reportMetrikaPremiumPurchaseConfirmed()
    await reportMetrikaPremiumPurchaseConfirmed()
    const purchases = calls.filter((c) => c[1] === 'reachGoal' && c[2] === 'premium_purchase')
    expect(purchases).toHaveLength(1)
  })

  it('mirrors start_game and yookassa_redirect without leaking props', async () => {
    setMetrikaConsent('granted')
    const calls: unknown[][] = []
    window.ym = ((...args: unknown[]) => {
      calls.push(args)
    }) as typeof window.ym
    const script = document.createElement('script')
    script.dataset.gnhMetrika = '1'
    document.head.appendChild(script)
    await enableYandexMetrika()

    mirrorTrackEventToMetrika('start_game', { gameId: 'mafia', token: 'nope' })
    await vi.waitFor(() => {
      expect(calls.some((c) => c[1] === 'reachGoal' && c[2] === 'game_start')).toBe(true)
    })
    const start = calls.find((c) => c[1] === 'reachGoal' && c[2] === 'game_start')
    expect(start?.[3]).toEqual({ gameId: 'mafia' })

    mirrorTrackEventToMetrika('yookassa_redirect', { planId: 'web_3m' })
    await vi.waitFor(() => {
      expect(calls.some((c) => c[1] === 'reachGoal' && c[2] === 'premium_payment_start')).toBe(true)
    })
  })
})