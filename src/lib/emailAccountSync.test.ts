import { describe, expect, it, vi } from 'vitest'
import {
  emailBindErrorMessage,
  isEmailConfirmationDone,
  premiumPhase,
  saveEmailAndSync,
  type EmailSyncPhase,
} from './emailAccountSync'

function deps(answer: { mode?: 'verify_sent' | 'verified' } | Error, premium = false) {
  const phases: EmailSyncPhase[] = []
  return {
    phases,
    d: {
      bind: vi.fn(async () => {
        if (answer instanceof Error) throw answer
        return answer
      }),
      refreshSession: vi.fn(async () => null),
      refreshPremium: vi.fn(async () => ({ isPremium: premium })),
      onPhase: (p: EmailSyncPhase) => phases.push(p),
    },
  }
}

describe('saveEmailAndSync', () => {
  it('mailed link: saving → checking → confirm; Premium is not looked up by the address alone', async () => {
    const { d, phases } = deps({ mode: 'verify_sent' }, true)
    expect(await saveEmailAndSync('a@b.co', d)).toEqual({ phase: 'confirm' })
    expect(phases).toEqual(['saving', 'checking'])
    expect(d.refreshPremium).not.toHaveBeenCalled()
  })

  it('address already confirmed on this account: shows Premium or a ready account', async () => {
    expect((await saveEmailAndSync('a@b.co', deps({ mode: 'verified' }, true).d)).phase).toBe('restored')
    expect((await saveEmailAndSync('a@b.co', deps({ mode: 'verified' }, false).d)).phase).toBe('ready')
  })

  it('errors become a readable message and never a success state', async () => {
    const err = Object.assign(new Error('x'), { status: 429 })
    const { d } = deps(err)
    expect(await saveEmailAndSync('a@b.co', d)).toEqual({
      phase: 'error',
      error: 'Слишком много попыток. Подождите минуту и попробуйте снова.',
    })
    expect(d.refreshSession).not.toHaveBeenCalled()
  })
})

describe('emailBindErrorMessage', () => {
  it('maps server answers', () => {
    expect(emailBindErrorMessage({ status: 409, code: 'email_already_verified' })).toMatch(/другая почта/)
    expect(emailBindErrorMessage({ status: 400 })).toMatch(/опечатка/)
    expect(emailBindErrorMessage({ status: 502 })).toMatch(/Не удалось отправить письмо/)
  })
})

describe('isEmailConfirmationDone', () => {
  const started = { accountId: 'acc-guest', email: 'Payer@Example.com' }
  it('switched to the paying account after the link', () => {
    expect(isEmailConfirmationDone({ ok: true, source: 'web_account', webAccountId: 'acc-paid' }, started)).toBe(true)
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