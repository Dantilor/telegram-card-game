/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getInitData = vi.fn()
const ensureTelegramSdkLoaded = vi.fn(() => Promise.resolve(true))
const isTelegramSdkReady = vi.fn(() => false)

vi.mock('./telegram', () => ({
  getInitData: () => getInitData(),
}))

vi.mock('./telegramSdk', () => ({
  ensureTelegramSdkLoaded: () => ensureTelegramSdkLoaded(),
  isTelegramSdkReady: () => isTelegramSdkReady(),
  TELEGRAM_SDK_READY_EVENT: 'gnh:telegram-sdk-ready',
}))

describe('waitForInitData', () => {
  beforeEach(() => {
    vi.resetModules()
    getInitData.mockReset()
    ensureTelegramSdkLoaded.mockClear()
    isTelegramSdkReady.mockReturnValue(false)
  })

  it('returns immediately when initData is already present', async () => {
    getInitData.mockReturnValue('already')
    const { waitForInitData } = await import('./waitForInitData')
    await expect(waitForInitData(500, 20)).resolves.toBe('already')
  })

  it('resolves when initData appears after the SDK ready event', async () => {
    getInitData.mockReturnValue('')
    const { waitForInitData } = await import('./waitForInitData')
    const pending = waitForInitData(1000, 20)
    window.setTimeout(() => {
      getInitData.mockReturnValue('late-signed')
      window.dispatchEvent(new Event('gnh:telegram-sdk-ready'))
    }, 30)
    await expect(pending).resolves.toBe('late-signed')
    expect(ensureTelegramSdkLoaded).toHaveBeenCalled()
  })
})
