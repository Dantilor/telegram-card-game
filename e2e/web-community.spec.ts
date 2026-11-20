import { test, expect } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'

const OUT = path.join(process.cwd(), 'artifacts', 'web-quality-qa')

test.describe('WEB community section', () => {
  test.beforeAll(() => {
    fs.mkdirSync(OUT, { recursive: true })
  })

  test('home shows community links and screenshots', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')

    const later = page.getByRole('button', { name: 'Позже' })
    try {
      await later.waitFor({ state: 'visible', timeout: 4000 })
      await later.click()
      await expect(later).toBeHidden({ timeout: 4000 })
    } catch {
      // Sheet may already be dismissed for this browser profile.
    }

    // Hide any leftover legal overlay for a clean screenshot of the community block.
    await page.addStyleTag({
      content: '.legal-choice, .first-use-sheet, [data-legal-sheet] { display: none !important; }',
    })

    const title = page.locator('#gnh-community-title')
    await expect(title).toBeVisible({ timeout: 20000 })
    await title.evaluate((el) => el.scrollIntoView({ block: 'center' }))

    const section = page.locator('section.gnh-community')
    await expect(section).toBeVisible()
    await expect(section).toContainText('GAME NIGHT COMMUNITY')

    const telegram = page.locator('section.gnh-community a[href="https://t.me/GameNightHostBot_news"]')
    const instagram = page.locator(
      'section.gnh-community a[href="https://www.instagram.com/gamenighthostbot/"]'
    )
    const miniapp = page.locator('section.gnh-community a[href="https://t.me/GameNightHostBot"]')
    await expect(telegram).toBeVisible()
    await expect(instagram).toBeVisible()
    await expect(miniapp).toBeVisible()
    await expect(telegram).toHaveAttribute('rel', /noopener/)
    await expect(instagram).toHaveAttribute('rel', /noopener/)
    await expect(miniapp).toHaveAttribute('rel', /noopener/)

    await expect(page.locator('section.gnh-community a[href="https://t.me/GameNightHelp"]')).toHaveCount(0)
    await expect(page.locator('a[href="https://t.me/GameNightHelp"]').first()).toBeAttached()

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)

    const box = await section.boundingBox()
    expect(box).toBeTruthy()
    await page.screenshot({
      path: path.join(OUT, 'community-mobile-390.png'),
      clip: { x: Math.max(0, box!.x), y: Math.max(0, box!.y), width: box!.width, height: box!.height },
    })

    await page.setViewportSize({ width: 1440, height: 900 })
    await title.evaluate((el) => el.scrollIntoView({ block: 'center' }))
    await expect(section).toBeVisible()
    const desk = await section.boundingBox()
    expect(desk).toBeTruthy()
    await page.screenshot({
      path: path.join(OUT, 'community-desktop-1440.png'),
      clip: { x: Math.max(0, desk!.x), y: Math.max(0, desk!.y), width: desk!.width, height: desk!.height },
    })
  })
})
