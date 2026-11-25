/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import EmailSyncStatus from '../components/EmailSyncStatus'
import { useEmailAccountSync } from './useEmailAccountSync'
import type { WebSessionMe } from '../lib/webAuth'

const saveContact = vi.fn()
const sendCode = vi.fn()
const confirmCode = vi.fn()
vi.mock('../lib/webAuth', () => ({
  saveProfileContactEmail: (email: string) => saveContact(email),
  startEmailCode: (email: string) => sendCode(email),
  completeEmailCode: (challenge: string, code: string) => confirmCode(challenge, code),
}))
const refreshPremium = vi.fn()
const guest: WebSessionMe = { ok: true, source: 'web_account', webAccountId: 'guest' }

function Harness() {
  const flow = useEmailAccountSync({
    session: guest,
    refreshSession: async () => guest,
    refreshPremium,
    startEmailPendingWatch: () => undefined,
    stopEmailPendingWatch: () => undefined,
  })
  return (
    <div>
      <button onClick={() => void flow.save('buyer@example.com')}>Сохранить</button>
      {flow.phase === 'confirm' && (
        <button onClick={() => void flow.verifyCode('123456')}>Ввести код</button>
      )}
      <EmailSyncStatus phase={flow.phase} error={flow.error} email={flow.pendingEmail} />
      {flow.codeError && <p role="alert">{flow.codeError}</p>}
    </div>
  )
}
const start = async () => {
  render(<Harness />)
  await act(async () => { fireEvent.click(screen.getByText('Сохранить')) })
}
describe('in-place profile email verification', () => {
  beforeEach(() => {
    saveContact.mockReset().mockResolvedValue({ mode: 'saved' })
    sendCode.mockReset().mockResolvedValue({ mode: 'code_sent', challengeId: '99' })
    confirmCode.mockReset().mockResolvedValue({ ok: true })
    refreshPremium.mockReset()
  })
  afterEach(() => cleanup())

  it('Premium already in current guest session: no email sent', async () => {
    refreshPremium.mockResolvedValue({ isPremium: true })
    await start()
    expect(screen.getByText('Premium активен!')).toBeTruthy()
    expect(sendCode).not.toHaveBeenCalled()
  })

  it('Purchase on another browser: code appears in same profile and unlocks after verification', async () => {
    refreshPremium.mockResolvedValueOnce({ isPremium: false }).mockResolvedValueOnce({ isPremium: true })
    await start()
    expect(screen.getByText('Введите 6-значный код из письма')).toBeTruthy()
    expect(sendCode).toHaveBeenCalledWith('buyer@example.com')
    await act(async () => { fireEvent.click(screen.getByText('Ввести код')) })
    expect(confirmCode).toHaveBeenCalledWith('99', '123456')
    expect(screen.getByText('Premium активен!')).toBeTruthy()
  })

  it('Wrong code stays in same screen for a retry', async () => {
    refreshPremium.mockResolvedValue({ isPremium: false })
    confirmCode.mockRejectedValueOnce(Object.assign(new Error('wrong'), { code: 'invalid_code', status: 400 }))
    await start()
    await act(async () => { fireEvent.click(screen.getByText('Ввести код')) })
    expect(screen.getByText('Введите 6-значный код из письма')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toMatch(/Неверный/)
  })
})
