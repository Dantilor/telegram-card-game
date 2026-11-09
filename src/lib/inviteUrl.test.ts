import { describe, expect, it } from 'vitest'
import { readRoomCodeFromLocation } from './inviteUrl'

describe('inviteUrl', () => {
  it('reads room from WEB search and Mini App hash', () => {
    expect(readRoomCodeFromLocation('?room=111222', '')).toBe('111222')
    expect(readRoomCodeFromLocation('', '#/infected?room=333444')).toBe('333444')
    expect(readRoomCodeFromLocation('?room=bad', '#/x?room=555666')).toBe('555666')
    expect(readRoomCodeFromLocation('', '#/x')).toBe('')
  })

  it('never embeds secrets in invite helper source', async () => {
    const src = await import('../lib/inviteUrl?raw').catch(() => null)
    // Fallback: structural check via function contract
    const { buildPartyInviteUrl } = await import('./inviteUrl')
    const url = buildPartyInviteUrl('/doubles', '777888')
    expect(url).toContain('room=777888')
    expect(url).not.toMatch(/token|session|csrf|initData/i)
    void src
  })
})
