import { afterEach, describe, expect, it, vi } from 'vitest'
import { isWebMetrikaFeatureEnabled } from './metrikaFeature'

describe('isWebMetrikaFeatureEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('is off by default in every shell', () => {
    expect(isWebMetrikaFeatureEnabled()).toBe(false)
    vi.stubEnv('VITE_GNH_SHELL', 'web')
    expect(isWebMetrikaFeatureEnabled()).toBe(false)
  })

  it('stays off in the Telegram Mini App shell even if the flag leaks into its build', () => {
    vi.stubEnv('VITE_GNH_SHELL', 'telegram')
    vi.stubEnv('VITE_GNH_METRIKA_ENABLED', '1')
    expect(isWebMetrikaFeatureEnabled()).toBe(false)
  })

  it('turns on only for the WEB shell with the explicit flag', () => {
    vi.stubEnv('VITE_GNH_SHELL', 'web')
    vi.stubEnv('VITE_GNH_METRIKA_ENABLED', '1')
    expect(isWebMetrikaFeatureEnabled()).toBe(true)
    vi.stubEnv('VITE_GNH_METRIKA_ENABLED', 'true')
    expect(isWebMetrikaFeatureEnabled()).toBe(false)
  })
})