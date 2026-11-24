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
  PREMIUM_PURCHASE_METRIKA_ENABLED,
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

  it('loads official tag.js once after grant and inits without webvisor/clickmap/trackLinks', async () => {
    setMetrikaConsent('granted')
    const calls: unknown[][] = []
    window.ym = ((...args: unknown[]) => {
      calls.push(args)
    }) as typeof window.ym

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
    expect(init.clickmap).toBe(false)
    expect(init.trackLinks).toBe(false)

    await enableYandexMetrika()
    expect(calls.filter((c) => c[1] === 'init')).toHaveLength(1)
  })

  it('sends a single SPA hit per path and scrubbed reachGoal params', async () => {
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

  it('on revoke calls destruct, sets opt-out, removes script, and blocks further hits', async () => {
    setMetrikaConsent('granted')
    const calls: unknown[][] = []
    window.ym = ((...args: unknown[]) => {
      calls.push(args)
    }) as typeof window.ym
    const script = document.createElement('script')
    script.dataset.gnhMetrika = '1'
    script.src = METRIKA_SCRIPT_URL
    document.head.appendChild(script)
    await enableYandexMetrika()

    setMetrikaConsent('denied')
    disableYandexMetrika()
    expect(document.querySelector('script[data-gnh-metrika="1"]')).toBeNull()
    expect(isMetrikaInitialized()).toBe(false)
    expect(calls.some((c) => c[1] === 'destruct')).toBe(true)
    expect((window as unknown as Record<string, unknown>)[`disableYaCounter${METRIKA_COUNTER_ID}`]).toBe(true)

    hitYandexMetrika('/games')
    expect(calls.filter((c) => c[1] === 'hit')).toHaveLength(0)
  })

  it('does not emit premium_purchase while the goal is disabled', async () => {
    expect(PREMIUM_PURCHASE_METRIKA_ENABLED).toBe(false)
    setMetrikaConsent('granted')
    const calls: unknown[][] = []
    window.ym = ((...args: unknown[]) => {
      calls.push(args)
    }) as typeof window.ym
    const script = document.createElement('script')
    script.dataset.gnhMetrika = '1'
    document.head.appendChild(script)
    await enableYandexMetrika()

    markMetrikaPaymentPending()
    await reportMetrikaPremiumPurchaseConfirmed()
    await reportMetrikaPremiumPurchaseConfirmed()
    expect(calls.some((c) => c[1] === 'reachGoal' && c[2] === 'premium_purchase')).toBe(false)
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