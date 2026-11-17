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

  it('preserves the signed Telegram launch for asynchronous SDK loading before HashRouter', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
    // Never block the first React module on an external deferred SDK.
    expect(html).not.toMatch(/<script defer[^>]*telegram-web-app\.js/)
    const entry = readFileSync(resolve(process.cwd(), 'src/main.tsx'), 'utf8')
    expect(entry).toMatch(/Boolean\(parseAndCacheFromHash\(\)\)/)
    expect(entry).toMatch(/if \(launchCaptured\)/)
    // Preserve the SDK-first fallback if Telegram WebView storage is disabled.
    expect(entry).toMatch(/whenTelegramSdkReady\(3500\)/)
    const sdk = readFileSync(resolve(process.cwd(), 'public/telegram-web-app.js'), 'utf8')
    const cache = readFileSync(resolve(process.cwd(), 'src/utils/telegramInitCache.ts'), 'utf8')
    expect(sdk).toMatch(/sessionStorageGet\('initParams'\)/)
    expect(cache).toContain('__telegram__initParams')
    expect(cache).toContain('primeTelegramSdkInitParams(params)')
  })

  it('loads only latin and cyrillic @fontsource subsets from main', () => {
    const main = readFileSync(resolve(process.cwd(), 'src/main.tsx'), 'utf8')
    expect(main).toMatch(/@fontsource\/manrope\/latin-400\.css/)
    expect(main).toMatch(/@fontsource\/manrope\/cyrillic-400\.css/)
    expect(main).not.toMatch(/@fontsource\/manrope\/\d+\.css/)
    expect(main).not.toMatch(/fonts\.googleapis\.com/)
  })
})
