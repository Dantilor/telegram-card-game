/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('web telegram devices client helpers', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  it('fetchTelegramDevices maps list payload', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        linked: true,
        devicesUsed: 2,
        devicesLimit: 3,
        devices: [
          {
            id: '11111111-1111-1111-1111-111111111111',
            label: 'Chrome',
            linkedAt: '2026-01-01T00:00:00.000Z',
            lastActiveAt: '2026-01-02T00:00:00.000Z',
            isCurrent: true,
            isLegacy: false,
          },
        ],
      }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    const { fetchTelegramDevices } = await import('./webAuth')
    const listed = await fetchTelegramDevices()
    expect(listed.devicesUsed).toBe(2)
    expect(listed.devicesLimit).toBe(3)
    expect(listed.devices[0]?.label).toBe('Chrome')
    expect(fetchMock).toHaveBeenCalled()
  })

  it('fetchTelegramLinkStatus exposes lastErrorCode for restore UX', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          ok: true,
          linked: false,
          telegramId: null,
          linkedAt: null,
          pendingChallengeExpiresAt: '2099-01-01T00:00:00.000Z',
          isPremium: false,
          activeUntil: null,
          sources: [],
          devicesUsed: 3,
          devicesLimit: 3,
          lastErrorCode: 'device_limit_reached',
        }),
      }))
    )
    const { fetchTelegramLinkStatus } = await import('./webAuth')
    const status = await fetchTelegramLinkStatus()
    expect(status.lastErrorCode).toBe('device_limit_reached')
    expect(status.devicesUsed).toBe(3)
  })
})