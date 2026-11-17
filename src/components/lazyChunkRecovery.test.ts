// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { safeReloadForStaleLazyChunk } from './lazyChunkRecovery'
import { prefetchPremiumOverlay } from './LazyPremiumOverlay'

const recover = vi.hoisted(() => ({
  recoverMissingGameChunk: vi.fn(() => true),
  showChunkRecoveryNotice: vi.fn(),
  isChunkLoadError: vi.fn((reason: unknown) =>
    /Failed to fetch dynamically imported module|Loading chunk/i.test(String(reason instanceof Error ? reason.message : reason)),
  ),
}))

vi.mock('../lib/chunkRecovery', () => ({
  recoverMissingGameChunk: (...args: unknown[]) => recover.recoverMissingGameChunk(...args),
  showChunkRecoveryNotice: (...args: unknown[]) => recover.showChunkRecoveryNotice(...args),
  isChunkLoadError: (...args: unknown[]) => recover.isChunkLoadError(...args),
}))

const loaders = vi.hoisted(() => ({
  premium: vi.fn(),
}))

vi.mock('./lazyChunkLoaders', () => ({
  importPremiumOverlay: () => loaders.premium(),
  importFirstUseSheet: () => Promise.resolve({ default: () => null }),
  importLegalDocumentModal: () => Promise.resolve({ default: () => null }),
}))

afterEach(() => {
  vi.restoreAllMocks()
  loaders.premium.mockReset()
  recover.recoverMissingGameChunk.mockReset()
  recover.showChunkRecoveryNotice.mockReset()
  recover.recoverMissingGameChunk.mockReturnValue(true)
})

describe('prefetchPremiumOverlay', () => {
  it('swallows rejected prefetch Promises without an unhandled rejection', async () => {
    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason)
    }
    process.on('unhandledRejection', onUnhandled)
    loaders.premium.mockRejectedValue(new Error('Failed to fetch dynamically imported module'))
    prefetchPremiumOverlay()
    await new Promise((resolve) => setTimeout(resolve, 0))
    process.off('unhandledRejection', onUnhandled)
    expect(unhandled).toEqual([])
  })
})

describe('safeReloadForStaleLazyChunk', () => {
  it('uses the guarded Telegram-preserving reload when allowed', () => {
    recover.recoverMissingGameChunk.mockReturnValue(true)
    expect(safeReloadForStaleLazyChunk()).toBe(true)
    expect(recover.recoverMissingGameChunk).toHaveBeenCalledTimes(1)
    expect(recover.showChunkRecoveryNotice).not.toHaveBeenCalled()
  })

  it('shows a manual notice instead of looping when reload is blocked', () => {
    recover.recoverMissingGameChunk.mockReturnValue(false)
    expect(safeReloadForStaleLazyChunk()).toBe(false)
    expect(recover.showChunkRecoveryNotice).toHaveBeenCalledTimes(1)
  })
})
