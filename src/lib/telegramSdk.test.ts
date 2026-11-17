/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('telegramSdk', () => {
  beforeEach(() => {
    vi.resetModules()
    document.head.innerHTML = ''
    delete (window as Window & { Telegram?: unknown }).Telegram
    delete (window as Window & { __GNH_TG_SDK__?: unknown }).__GNH_TG_SDK__
  })

  afterEach(() => {
    document.head.innerHTML = ''
    delete (window as Window & { Telegram?: unknown }).Telegram
    delete (window as Window & { __GNH_TG_SDK__?: unknown }).__GNH_TG_SDK__
  })

  it('resolves immediately when WebApp is already present', async () => {
    ;(window as Window & { Telegram?: { WebApp: { initData: string } } }).Telegram = {
      WebApp: { initData: 'signed' },
    }
    const { ensureTelegramSdkLoaded, isTelegramSdkReady } = await import('./telegramSdk')
    await expect(ensureTelegramSdkLoaded()).resolves.toBe(true)
    expect(isTelegramSdkReady()).toBe(true)
    expect(document.querySelector('script[data-gnh-telegram-sdk="1"]')).toBeNull()
  })

  it('injects an async same-origin script and emits ready after load', async () => {
    const { ensureTelegramSdkLoaded, TELEGRAM_SDK_READY_EVENT } = await import('./telegramSdk')
    const ready = new Promise<void>((resolve) => {
      window.addEventListener(TELEGRAM_SDK_READY_EVENT, () => resolve(), { once: true })
    })

    const pending = ensureTelegramSdkLoaded()
    const script = document.querySelector<HTMLScriptElement>('script[data-gnh-telegram-sdk="1"]')
    expect(script).toBeTruthy()
    expect(script?.async).toBe(true)
    expect(script?.src).toMatch(/telegram-web-app\.js/)

    ;(window as Window & { Telegram?: { WebApp: { initData: string } } }).Telegram = {
      WebApp: { initData: 'signed-from-sdk' },
    }
    script?.dispatchEvent(new Event('load'))

    await expect(pending).resolves.toBe(true)
    await ready
  })

  it('does not invent WebApp data when the script fails', async () => {
    const sdk = await import('./telegramSdk')
    const telegram = await import('./telegram')

    const pending = sdk.ensureTelegramSdkLoaded()
    const script = document.querySelector<HTMLScriptElement>('script[data-gnh-telegram-sdk="1"]')
    script?.dispatchEvent(new Event('error'))
    await expect(pending).resolves.toBe(false)
    expect(sdk.isTelegramSdkReady()).toBe(false)
    expect(telegram.getInitData()).toBe('')
  })
})
