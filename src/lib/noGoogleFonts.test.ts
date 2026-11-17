import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('cold-start fonts', () => {
  it('does not reference Google Fonts hosts in the HTML shell', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
    expect(html).not.toMatch(/fonts\.googleapis\.com/i)
    expect(html).not.toMatch(/fonts\.gstatic\.com/i)
    expect(html).not.toMatch(/telegram\.org\/js\/telegram-web-app\.js/i)
  })

  it('initializes local Telegram SDK before clearing launch hash for HashRouter', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
    // Vite replaces BASE_URL in both GitHub Pages and Timeweb static builds.
    expect(html).toMatch(/<script defer src="%BASE_URL%telegram-web-app\.js"><\/script>/)
    const entry = readFileSync(resolve(process.cwd(), 'src/main.tsx'), 'utf8')
    expect(entry).toMatch(/hasTelegramLaunchHash && !isTelegramSdkReady\(\)/)
    expect(entry).toMatch(/whenTelegramSdkReady\(3500\)/)
    const sdk = readFileSync(resolve(process.cwd(), 'public/telegram-web-app.js'), 'utf8')
    expect(sdk).toMatch(/locationHash = location\.hash\.toString\(\)/)
  })

  it('loads only latin and cyrillic @fontsource subsets from main', () => {
    const main = readFileSync(resolve(process.cwd(), 'src/main.tsx'), 'utf8')
    expect(main).toMatch(/@fontsource\/manrope\/latin-400\.css/)
    expect(main).toMatch(/@fontsource\/manrope\/cyrillic-400\.css/)
    expect(main).not.toMatch(/@fontsource\/manrope\/\d+\.css/)
    expect(main).not.toMatch(/fonts\.googleapis\.com/)
  })
})
