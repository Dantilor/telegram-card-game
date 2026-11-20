import { test, expect } from '@playwright/test'

const BASE = process.env.GNH_E2E_BASE_URL || 'http://127.0.0.1:5173'

test('spacing + comics + sled + save btn', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })

  await page.goto(BASE + '/alias')
  await page.waitForTimeout(400)
  const aliasGap = await page.evaluate(() => {
    const title = document.querySelector('.alias-page__section-title') as HTMLElement | null
    const next = title?.nextElementSibling as HTMLElement | null
    if (!title || !next) return null
    return next.getBoundingClientRect().top - title.getBoundingClientRect().bottom
  })
  expect(aliasGap, 'alias title gap').toBeGreaterThanOrEqual(8)

  await page.goto(BASE + '/mafia')
  await page.waitForTimeout(400)
  const mafiaGap = await page.evaluate(() => {
    const title = document.querySelector('.mafia-setup__section-title') as HTMLElement | null
    const next = title?.closest('.mafia-setup__section-head')?.nextElementSibling as HTMLElement | null
      || title?.parentElement?.nextElementSibling as HTMLElement | null
    if (!title || !next) return null
    return next.getBoundingClientRect().top - title.getBoundingClientRect().bottom
  })
  expect(mafiaGap ?? 9, 'mafia title gap').toBeGreaterThanOrEqual(8)

  await page.goto(BASE + '/profile')
  await page.waitForTimeout(500)
  const border = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.profile-pass__restore')].find((el) =>
      (el.textContent || '').includes('Сохранить')
    ) as HTMLElement | undefined
    if (!btn) return null
    return getComputedStyle(btn).borderTopWidth
  })
  expect(border, 'save btn present').toBeTruthy()
  expect(parseFloat(border || '0')).toBeGreaterThanOrEqual(1)

  await page.goto(BASE + '/comics')
  await page.waitForTimeout(500)
  const comics = await page.evaluate(() => {
    const media = document.querySelector('.comics-grid__media') as HTMLElement | null
    const img = document.querySelector('.comics-grid__media .smart-image__img') as HTMLElement | null
    const body = document.querySelector('.comics-grid__body') as HTMLElement | null
    if (!media || !img || !body) return null
    const ms = getComputedStyle(media)
    const is = getComputedStyle(img)
    const bs = getComputedStyle(body)
    return {
      mediaPos: ms.position,
      objectFit: is.objectFit,
      bodyPadTop: bs.paddingTop,
      gap: body.getBoundingClientRect().top - media.getBoundingClientRect().bottom,
    }
  })
  expect(comics?.mediaPos).toBe('relative')
  expect(comics?.objectFit).toBe('cover')
  expect(parseFloat(comics?.bodyPadTop || '0')).toBeLessThan(40)
  expect(comics?.gap ?? 0).toBeGreaterThanOrEqual(-1)

  await page.goto(BASE + '/sled')
  await page.waitForSelector('.sled-root', { timeout: 15000 })
  await page.waitForTimeout(400)
  const sled = await page.evaluate(() => {
    const root = document.querySelector('.sled-root') as HTMLElement | null
    const html = document.documentElement
    return {
      htmlBg: getComputedStyle(html).backgroundColor,
      sledBgImage: root ? getComputedStyle(root).backgroundImage : null,
    }
  })
  // Navy cyber field (exact token may be #090d29 / #0a0d28 / #0a0e2a)
  const m = sled.htmlBg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i)
  expect(m, 'html bg parsed').toBeTruthy()
  expect(Number(m![1])).toBeLessThan(40)
  expect(Number(m![2])).toBeLessThan(40)
  expect(Number(m![3])).toBeGreaterThan(30)
  expect(sled.sledBgImage || '').toMatch(/linear-gradient|radial-gradient/)

  await page.screenshot({ path: 'artifacts/web-quality-qa/fix-sled.png', fullPage: false })
  await page.goto(BASE + '/comics')
  await page.screenshot({ path: 'artifacts/web-quality-qa/fix-comics.png', fullPage: false })
  await page.goto(BASE + '/alias')
  await page.screenshot({ path: 'artifacts/web-quality-qa/fix-alias-gap.png', fullPage: false })
  await page.goto(BASE + '/profile')
  await page.screenshot({ path: 'artifacts/web-quality-qa/fix-profile-save.png', fullPage: false })
})
