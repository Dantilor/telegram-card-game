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

  it('loads only latin and cyrillic @fontsource subsets from main', () => {
    const main = readFileSync(resolve(process.cwd(), 'src/main.tsx'), 'utf8')
    expect(main).toMatch(/@fontsource\/manrope\/latin-400\.css/)
    expect(main).toMatch(/@fontsource\/manrope\/cyrillic-400\.css/)
    expect(main).not.toMatch(/@fontsource\/manrope\/\d+\.css/)
    expect(main).not.toMatch(/fonts\.googleapis\.com/)
  })
})
