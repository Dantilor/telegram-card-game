import { beforeEach, describe, expect, it, vi } from 'vitest'

const getInitData = vi.fn()

vi.mock('./telegram', () => ({
  getInitData: () => getInitData(),
}))

describe('waitForInitData', () => {
  beforeEach(() => {
    getInitData.mockReset()
  })

  it('returns immediately when initData is already present', async () => {
    getInitData.mockReturnValue('already')
    const { waitForInitData } = await import('./waitForInitData')
    await expect(waitForInitData(500, 50)).resolves.toBe('already')
    expect(getInitData).toHaveBeenCalledTimes(1)
  })

  it('resolves when initData appears after a short delay', async () => {
    getInitData.mockReturnValueOnce('').mockReturnValueOnce('').mockReturnValue('late')
    const { waitForInitData } = await import('./waitForInitData')
    await expect(waitForInitData(500, 20)).resolves.toBe('late')
  })
})
