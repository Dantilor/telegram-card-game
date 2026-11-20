import { test, expect, type Page } from '@playwright/test'

const BASE = process.env.GNH_E2E_BASE_URL || 'http://127.0.0.1:5173'
const MAUVE = { r: 136, g: 112, b: 153 }
const KIT = { r: 21, g: 16, b: 37 }

function near(actual: { r: number; g: number; b: number }, expected: { r: number; g: number; b: number }, tol = 28) {
  return (
    Math.abs(actual.r - expected.r) <= tol &&
    Math.abs(actual.g - expected.g) <= tol &&
    Math.abs(actual.b - expected.b) <= tol
  )
}

function isNearWhite(c: { r: number; g: number; b: number }) {
  return c.r > 235 && c.g > 235 && c.b > 235
}

function isTransparent(input: string) {
  return input === 'transparent' || input === 'rgba(0, 0, 0, 0)'
}

function parseRgb(input: string) {
  const m = input.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i)
  if (!m) return { r: 255, g: 255, b: 255 }
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) }
}

async function sampleBottom(page: Page) {
  return page.evaluate(() => {
    const root = document.getElementById('root')
    const app = document.querySelector('.app') as HTMLElement | null
    return {
      innerHeight: window.innerHeight,
      shell: document.documentElement.getAttribute('data-gnh-shell'),
      htmlH: document.documentElement.clientHeight,
      rootH: root?.clientHeight ?? 0,
      appH: app?.clientHeight ?? 0,
      htmlBg: getComputedStyle(document.documentElement).backgroundColor,
      bodyBg: getComputedStyle(document.body).backgroundColor,
      rootBg: root ? getComputedStyle(root).backgroundColor : 'missing',
      appBg: app ? getComputedStyle(app).backgroundColor : 'missing',
      overflowY: getComputedStyle(document.documentElement).overflowY,
    }
  })
}

test.describe('iPhone PWA bottom strip', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  })

  for (const [name, route, expected] of [
    ['home', '/', MAUVE],
    ['catalog', '/games', MAUVE],
    ['comics', '/comics', MAUVE],
    ['profile', '/profile', MAUVE],
    ['premium', '/premium', KIT],
  ] as const) {
    test(`${name}: no white strip at bottom`, async ({ page }) => {
      await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(500)
      await page.evaluate(() => {
        const root =
          (document.querySelector('.app.app--web > .gnh-inside') as HTMLElement | null) ||
          (document.querySelector('.app.app--web > .gnh-home-scroll') as HTMLElement | null) ||
          (document.querySelector('.app.app--web') as HTMLElement | null)
        if (root) root.scrollTop = root.scrollHeight
        window.scrollTo(0, document.body.scrollHeight)
      })
      await page.waitForTimeout(200)

      const info = await sampleBottom(page)
      expect(info.shell, 'data-gnh-shell').toBe('web')

      // Canvas must fill the phone viewport (short --app-height left a white gap under #root).
      expect(info.htmlH).toBeGreaterThanOrEqual(info.innerHeight - 2)
      expect(info.rootH).toBeGreaterThanOrEqual(info.innerHeight - 2)

      const painted = [info.htmlBg, info.rootBg, info.appBg]
        .filter((bg) => !isTransparent(bg))
        .map(parseRgb)

      expect(painted.length, `${route} needs an opaque painted layer`).toBeGreaterThan(0)
      for (const c of painted) {
        expect(isNearWhite(c), `${route} painted layer is white`).toBeFalsy()
        expect(near(c, expected), `${route} painted ${JSON.stringify(c)}`).toBeTruthy()
      }

      // Body may be transparent if html/#root paint — but must never be white.
      if (!isTransparent(info.bodyBg)) {
        const body = parseRgb(info.bodyBg)
        expect(isNearWhite(body), `${route} body white`).toBeFalsy()
      }

      expect(info.overflowY === 'hidden' || info.overflowY === 'clip').toBeTruthy()
    })
  }
})
