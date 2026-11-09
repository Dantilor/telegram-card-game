import { describe, expect, it } from 'vitest'
import { PRELOAD_CRITICAL_URLS, PRELOAD_GAMES_CATALOG_URLS, PRELOAD_HOME_URLS } from './images'

describe('image preload lists', () => {
  it('keeps home preload tiny so cold start is not flooded', () => {
    expect(PRELOAD_HOME_URLS.length).toBeLessThanOrEqual(4)
    expect(PRELOAD_CRITICAL_URLS).toEqual(PRELOAD_HOME_URLS)
  })

  it('keeps the full games catalog out of the home-critical list', () => {
    expect(PRELOAD_GAMES_CATALOG_URLS.length).toBeGreaterThan(PRELOAD_HOME_URLS.length)
    for (const url of PRELOAD_HOME_URLS) {
      expect(PRELOAD_GAMES_CATALOG_URLS).toContain(url)
    }
  })
})
