import { describe, expect, it, vi } from 'vitest'
import {
  emailBindErrorMessage,
  isEmailConfirmationDone,
  premiumPhase,
  saveEmailAndSync,
  type EmailSyncPhase,
} from './emailAccountSync'

function deps(premium: boolean | null, contactMode: 'saved' | 'verified' = 'saved') {
  const phases: EmailSyncPhase[] = []
  return {
    phases,
    d: {
      saveContact: vi.fn(async () => ({ mode: contactMode })),
      requestConfirmation: vi.fn(async () => ({ mode: 'code_sent' as const, challengeId: '42' })),
      refreshSession: vi.fn(async () => null),
      refreshPremium: vi.fn(async () => premium === null ? null : ({ isPremium: premium })),
      onPhase: (p: EmailSyncPhase) => phases.push(p),
    },
  }
}

describe('saveEmailAndSync', () => {
  it('paid current browser: save contact + Premium visible, no mail', async () => {
    const { d, phases } = deps(true)
    expect(await saveEmailAndSync('a@b.co', d)).toEqual({ phase: 'restored' })
    expect(phases).toEqual(['saving', 'checking'])
    expect(d.saveContact).toHaveBeenCalledWith('a@b.co')
    expect(d.requestConfirmation).not.toHaveBeenCalled()
  })

  it('free current browser: automatically emails a code to restore older purchase', async () => {
    const { d, phases } = deps(false)
    expect(await saveEmailAndSync('a@b.co', d)).toEqual({ phase: 'confirm', challengeId: '42' })
    expect(phases).toEqual(['saving', 'checking'])
    expect(d.requestConfirmation).toHaveBeenCalledWith('a@b.co')
  })

  it('already verified email: no new mail, shows current account state', async () => {
    const { d } = deps(false, 'verified')
    expect((await saveEmailAndSync('a@b.co', d)).phase).toBe('ready')
    expect(d.requestConfirmation).not.toHaveBeenCalled()
  })

  it('failed Premium status: do not claim no purchase or send arbitrary mail', async () => {
    const { d } = deps(null)
    expect((await saveEmailAndSync('a@b.co', d)).phase).toBe('error')
    expect(d.requestConfirmation).not.toHaveBeenCalled()
  })

  it('mail failure reports failure but contact remains saved', async () => {
    const { d } = deps(false)
    d.requestConfirmation.mockRejectedValueOnce(new Error('smtp'))
    const result = await saveEmailAndSync('a@b.co', d)
    expect(result.phase).toBe('error')
    expect(result.error).toMatch(/отправить код/)
  })

  it('errors before save do not look like a success', async () => {
    const { d } = deps(false)
    d.saveContact.mockRejectedValueOnce(Object.assign(new Error('x'), { status: 429 }))
    expect(await saveEmailAndSync('a@b.co', d)).toEqual({
      phase: 'error', error: 'Слишком много попыток. Подождите минуту и попробуйте снова.',
    })
    expect(d.requestConfirmation).not.toHaveBeenCalled()
  })
})

describe('emailBindErrorMessage', () => {
  it('maps server answers', () => {
    expect(emailBindErrorMessage({ status: 409, code: 'email_already_verified' })).toMatch(/другая почта/)
    expect(emailBindErrorMessage({ status: 400 })).toMatch(/опечатка/)
    expect(emailBindErrorMessage({ status: 502 })).toMatch(/Не удалось сохранить email/)
  })
})

describe('isEmailConfirmationDone', () => {
  const started = { accountId: 'acc-guest', email: 'Payer@Example.com' }
  it('unrelated account switch never counts as proof of mailbox ownership', () => {
    expect(isEmailConfirmationDone({ ok: true, source: 'web_account', webAccountId: 'acc-paid' }, started)).toBe(false)
  })
  it('confirmed email on another account completes recovery', () => {
    expect(isEmailConfirmationDone({
      ok: true, source: 'web_account', webAccountId: 'acc-paid',
      email: 'payer@example.com', emailVerified: true,
    }, started)).toBe(true)
  })
  it('same account, email confirmed', () => {
    expect(
      isEmailConfirmationDone(
        { ok: true, source: 'web_account', webAccountId: 'acc-guest', email: 'payer@example.com', emailVerified: true },
        started
      )
    ).toBe(true)
  })
  it('still waiting: unconfirmed, another address, or no session', () => {
    expect(isEmailConfirmationDone({ ok: true, source: 'web_account', webAccountId: 'acc-guest' }, started)).toBe(false)
    expect(
      isEmailConfirmationDone(
        { ok: true, source: 'web_account', webAccountId: 'acc-guest', email: 'other@example.com', emailVerified: true },
        started
      )
    ).toBe(false)
    expect(isEmailConfirmationDone(null, started)).toBe(false)
  })
})

describe('premiumPhase', () => {
  it('retries once on a network error', async () => {
    const refresh = vi.fn().mockRejectedValueOnce(new Error('net')).mockResolvedValueOnce({ isPremium: true })
    expect(await premiumPhase(refresh)).toBe('restored')
    expect(refresh).toHaveBeenCalledTimes(2)
  })
})