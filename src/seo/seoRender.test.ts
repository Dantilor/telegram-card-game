import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { LANDING_PAGES, SEO_GAMES, SEO_PAGES, SITE_ORIGIN } from './seoContent'
import {
  appShellHead,
  buildJsonLd,
  buildRobotsTxt,
  buildSeoManifest,
  buildSitemapXml,
  injectIntoShell,
  isAppRoutePath,
  pageHead,
  renderSeoPageBody,
} from './seoRender'

const root = path.resolve(__dirname, '..', '..')
const SHELL = '<!doctype html><html lang="ru"><head><title>GameNight Host</title></head><body><div id="root"></div></body></html>'
const PRIVATE_PATHS = ['/profile', '/recover', '/login', '/email/confirm', '/link-web', '/premium', '/decks/custom/new', '/api/plans']

describe('robots.txt', () => {
  const robots = buildRobotsTxt()

  it('points to the canonical sitemap', () => {
    expect(robots).toContain(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`)
  })

  it('never blocks the whole site or assets needed for rendering', () => {
    const disallows = robots.split('\n').filter((l) => l.startsWith('Disallow:')).map((l) => l.slice(9).trim())
    expect(disallows).not.toContain('/')
    expect(disallows).not.toContain('')
    for (const asset of ['/assets/', '/seo/', '/og/', '/brand/', '/discover/', '/games']) {
      expect(disallows.some((d) => asset.startsWith(d))).toBe(false)
    }
    expect(disallows).toEqual(expect.arrayContaining(['/api/', '/email/confirm', '/link-web']))
  })

  it('keeps noindex pages crawlable so robots can see the noindex', () => {
    const disallows = robots.split('\n').filter((l) => l.startsWith('Disallow:')).map((l) => l.slice(9).trim())
    for (const p of ['/profile', '/recover', '/login', '/premium']) {
      expect(disallows.some((d) => p.startsWith(d))).toBe(false)
    }
  })
})

describe('sitemap.xml', () => {
  const xml = buildSitemapXml()
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])

  it('is a urlset with one entry per public SEO page', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(locs).toEqual(SEO_PAGES.map((p) => `${SITE_ORIGIN}${p.path}`))
    expect(new Set(locs).size).toBe(locs.length)
  })

  it('lists only canonical https URLs without params, fragments or private routes', () => {
    for (const loc of locs) {
      expect(loc.startsWith(`${SITE_ORIGIN}/`)).toBe(true)
      expect(loc).not.toMatch(/[?#]/)
      expect(loc === `${SITE_ORIGIN}/` || !loc.endsWith('/')).toBe(true)
      for (const p of PRIVATE_PATHS) expect(loc.startsWith(`${SITE_ORIGIN}${p}`)).toBe(false)
    }
  })

  it('uses real ISO dates for lastmod', () => {
    const dates = [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1])
    expect(dates).toHaveLength(locs.length)
    for (const d of dates) expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('page metadata', () => {
  it('has unique titles, descriptions and H1 within search-friendly lengths', () => {
    const titles = SEO_PAGES.map((p) => p.title)
    const descriptions = SEO_PAGES.map((p) => p.description)
    const h1s = SEO_PAGES.map((p) => p.h1)
    expect(new Set(titles).size).toBe(titles.length)
    expect(new Set(descriptions).size).toBe(descriptions.length)
    expect(new Set(h1s).size).toBe(h1s.length)
    for (const p of SEO_PAGES) {
      expect(p.title.length).toBeLessThanOrEqual(70)
      expect(p.description.length).toBeGreaterThanOrEqual(70)
      expect(p.description.length).toBeLessThanOrEqual(160)
    }
  })

  it('uses the requested home title, description and H1', () => {
    const home = SEO_PAGES.find((p) => p.path === '/')!
    expect(home.title).toBe('GameNight Host — онлайн-игры для компании и друзей')
    expect(home.h1).toBe('Игры для компании, друзей и незабываемых вечеров')
  })

  it('emits canonical, robots, Open Graph and Twitter tags for every public page', () => {
    for (const page of SEO_PAGES) {
      const head = pageHead(page)
      const url = `${SITE_ORIGIN}${page.path}`
      expect(head).toContain(`<link rel="canonical" href="${url}"`)
      expect(head).toContain(`<meta property="og:url" content="${url}"`)
      expect(head).toContain('content="index, follow, max-image-preview:large"')
      expect(head).toContain(`<meta property="og:image" content="${SITE_ORIGIN}${page.ogImage}"`)
      expect(head).toContain('<meta name="twitter:card" content="summary_large_image" />')
      expect(head).toContain('<meta property="og:image:width" content="1200" />')
    }
  })

  it('marks the app shell noindex without a canonical', () => {
    const head = appShellHead()
    expect(head).toContain('content="noindex, follow"')
    expect(head).not.toContain('rel="canonical"')
    expect(head).not.toContain('og:url')
  })

  it('ships real 1200x630 OG images and catalog covers', async () => {
    for (const page of SEO_PAGES) {
      const meta = await sharp(path.join(root, 'public', page.ogImage)).metadata()
      expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', 1200, 630])
    }
    for (const id of Object.keys(SEO_GAMES)) {
      expect(fs.existsSync(path.join(root, 'public', 'seo', 'covers', `${id}.webp`))).toBe(true)
    }
  })
})

describe('structured data', () => {
  it('uses only WebSite, Organization and BreadcrumbList', () => {
    for (const page of SEO_PAGES) {
      const json = JSON.stringify(buildJsonLd(page))
      const types = [...json.matchAll(/"@type":"([^"]+)"/g)].map((m) => m[1])
      for (const t of types) expect(['WebSite', 'Organization', 'BreadcrumbList', 'ListItem']).toContain(t)
      expect(json).not.toMatch(/aggregateRating|review|FAQPage|offers/i)
    }
  })
})

describe('prerendered markup', () => {
  it('injects head and body into the Vite shell', () => {
    const page = LANDING_PAGES[0]
    const html = injectIntoShell(SHELL, { head: pageHead(page), body: renderSeoPageBody(page) })
    expect(html).toContain(`<title>${page.title}</title>`)
    expect(html).not.toContain('<title>GameNight Host</title>')
    expect(html).toContain(`<h1>${page.h1}</h1>`)
    expect(html).not.toContain('<div id="root"></div>')
  })

  it('renders exactly one H1, game links and cross-links for every page', () => {
    for (const page of SEO_PAGES) {
      const body = renderSeoPageBody(page)
      expect(body.match(/<h1>/g)).toHaveLength(1)
      for (const g of page.games ?? []) expect(body).toContain(`href="${SEO_GAMES[g.id].route}"`)
      for (const other of LANDING_PAGES.filter((p) => p.path !== page.path)) {
        expect(body).toContain(`href="${other.path}"`)
      }
    }
  })

  it('shows covers on landings with alt text and keeps home/catalog text-only', () => {
    for (const page of SEO_PAGES) {
      const body = renderSeoPageBody(page)
      if (page.kind === 'landing') {
        expect(body).toMatch(/<img src="\/seo\/covers\/[a-z-]+\.webp" alt="[^"]+"/)
      } else {
        expect(body).not.toContain('<img')
      }
    }
  })

  it('does not leak personal data', () => {
    for (const page of SEO_PAGES) {
      const html = pageHead(page) + renderSeoPageBody(page)
      expect(html).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)
      expect(html).not.toMatch(/gnh_sid|initData|paymentId|token=/i)
    }
  })

  it('separates Mafia Lite and «Мафия: Тени города» on the mafia landing', () => {
    const mafia = LANDING_PAGES.find((p) => p.path === '/discover/mafiya-onlajn')!
    const body = renderSeoPageBody(mafia)
    expect(body).toContain('href="/mafia"')
    expect(body).toContain('href="/mafia-shadows"')
    expect(mafia.sections?.map((s) => s.heading)).toEqual(
      expect.arrayContaining(['Мафия Lite: как играть', '«Мафия: Тени города»: как играть']),
    )
  })
})

describe('server manifest and routing data', () => {
  it('maps every public page to a prerendered file', () => {
    const manifest = buildSeoManifest()
    expect(Object.keys(manifest.pages)).toEqual(SEO_PAGES.map((p) => p.path))
    expect(manifest.pages['/']).toBe('index.html')
    expect(manifest.pages['/games']).toBe('_seo/pages/games.html')
  })

  it('classifies app routes vs public pages', () => {
    for (const p of ['/profile', '/mafia/night', '/mafia-shadows', '/sled', '/recover', '/premium', '/play/aboutUs']) {
      expect(isAppRoutePath(p)).toBe(true)
    }
    for (const p of ['/', '/games', '/discover/mafiya-onlajn', '/unknown', '/mafiaxyz']) {
      expect(isAppRoutePath(p)).toBe(false)
    }
  })

  it('keeps the WEB footer links in sync with the landing pages', () => {
    const footer = fs.readFileSync(path.join(root, 'src', 'components', 'web', 'WebSiteFooter.tsx'), 'utf8')
    for (const page of LANDING_PAGES) expect(footer).toContain(`to: '${page.path}'`)
  })
})