import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { HOME_PICK_THUMBS, PRELOAD_CRITICAL_URLS, PRELOAD_GAMES_CATALOG_URLS, PRELOAD_HOME_URLS } from './images'

const source = (file: string) => readFileSync(join(process.cwd(), file), 'utf8')

describe('image preload lists', () => {
  it('keeps home preload tiny so cold start is not flooded', () => {
    expect(PRELOAD_HOME_URLS.length).toBeLessThanOrEqual(4)
    expect(PRELOAD_CRITICAL_URLS).toEqual(PRELOAD_HOME_URLS)
    expect(PRELOAD_HOME_URLS).toEqual(Object.values(HOME_PICK_THUMBS))
  })

  it('keeps the full games catalog out of the home-critical list', () => {
    expect(PRELOAD_GAMES_CATALOG_URLS.length).toBeGreaterThan(PRELOAD_HOME_URLS.length)
    for (const url of PRELOAD_HOME_URLS) {
      expect(PRELOAD_GAMES_CATALOG_URLS).not.toContain(url)
    }
  })
})

describe('startup asset guards', () => {
  it('Home uses compressed thumbnails, not the 2 MB catalog originals', () => {
    const home = source('src/pages/Home.tsx')
    expect(home).not.toMatch(/mafia_shadows_hero\.png|infected_cover\.png/)
    expect(home).toMatch(/optimized\/home-hero-/)
  })

  it('Premium banner and overlay use the compressed gem', () => {
    for (const file of ['src/components/HomePremiumBanner.tsx', 'src/components/PremiumOverlay.tsx']) {
      expect(source(file)).not.toMatch(/premium-diamond(-pro)?\.png/)
    }
  })

  it('App does not warm the games catalog images on the Home screen', () => {
    expect(source('src/App.tsx')).not.toMatch(/PRELOAD_GAMES_CATALOG_URLS/)
  })

  it('lock checks do not pull every question deck into the startup bundle', () => {
    expect(source('src/lib/access.ts')).not.toMatch(/data\/decks['"]/)
  })
})
