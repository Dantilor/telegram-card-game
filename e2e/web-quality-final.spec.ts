import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.GNH_E2E_BASE_URL || 'http://127.0.0.1:5173'
const OUT = path.join(process.cwd(), 'artifacts', 'web-quality-qa')
fs.mkdirSync(OUT, { recursive: true })

const ROUTES = [
  ['home', '/'],
  ['catalog', '/games'],
  ['premium', '/premium'],
  ['wheel', '/wheel'],
  ['comics', '/comics'],
  ['profile', '/profile'],
  ['alias', '/alias'],
  ['mafia', '/mafia'],
  ['russia-travel', '/russia-travel'],
  ['online', '/play'],
]

async function sampleTextColors(page: Page, selectors: string[]) {
  return page.evaluate((sels) => {
    const rows: Array<{ sel: string; color: string; fill: string; visible: boolean }> = []
    for (const sel of sels) {
      const el = document.querySelector(sel) as HTMLElement | null
      if (!el) {
        rows.push({ sel, color: 'missing', fill: 'missing', visible: false })
        continue
      }
      const cs = getComputedStyle(el)
      rows.push({
        sel,
        color: cs.color,
        fill: cs.webkitTextFillColor || '',
        visible: el.getClientRects().length > 0,
      })
    }
    return rows
  }, selectors)
}

function isLightInk(color: string) {
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i)
  if (!m) return false
  const r = Number(m[1]), g = Number(m[2]), b = Number(m[3])
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return lum > 0.55
}

for (const viewport of [
  { name: 'm375', width: 375, height: 667 },
  { name: 'm390', width: 390, height: 844 },
  { name: 'm430', width: 430, height: 932 },
  { name: 'd1440', width: 1440, height: 900 },
]) {
  test.describe(`WEB QA ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    test('routes screenshots + no overflow + contrast samples', async ({ page }) => {
      const report: any = { viewport, routes: [] }
      for (const [name, route] of ROUTES) {
        await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(400)
        const overflow = await page.evaluate(() => {
          const root = document.documentElement
          return {
            scrollWidth: root.scrollWidth,
            clientWidth: root.clientWidth,
            overflowX: root.scrollWidth > root.clientWidth + 2,
          }
        })
        const shot = path.join(OUT, `${viewport.name}-${name}.png`)
        await page.screenshot({ path: shot, fullPage: false })
        report.routes.push({ name, route, overflow, shot: path.basename(shot) })
        expect(overflow.overflowX, `${route} horizontal overflow`).toBeFalsy()
      }

      await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(500)
      const profileColors = await sampleTextColors(page, [
        '.profile-pass__perk',
        '.profile-pass__title',
        '.profile-menu__title',
        '.web-site-footer__name',
        '.web-site-footer__tagline',
      ])
      report.profileColors = profileColors
      for (const row of profileColors) {
        if (row.color === 'missing') continue
        expect(isLightInk(row.color) || isLightInk(row.fill), `${row.sel} should be light ink got ${row.color}`).toBeTruthy()
      }

      await page.goto(`${BASE}/mafia`, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(500)
      const mafiaColors = await sampleTextColors(page, [
        '.mafia-setup__section-title',
        '.mafia-page__input',
      ])
      report.mafiaColors = mafiaColors
      for (const row of mafiaColors) {
        if (row.color === 'missing') continue
        expect(isLightInk(row.color) || isLightInk(row.fill), `${row.sel} should be light ink got ${row.color}`).toBeTruthy()
      }

      await page.goto(`${BASE}/alias`, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(500)
      const aliasColors = await sampleTextColors(page, [
        '.teams-setup__title',
        '.teams-setup__label',
        '.teams-setup__players-label',
      ])
      report.aliasColors = aliasColors
      for (const row of aliasColors) {
        if (row.color === 'missing') continue
        expect(isLightInk(row.color) || isLightInk(row.fill), `${row.sel} should be light ink got ${row.color}`).toBeTruthy()
      }

      fs.writeFileSync(path.join(OUT, `${viewport.name}-report.json`), JSON.stringify(report, null, 2))
    })
  })
}
