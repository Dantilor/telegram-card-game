/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import EmailSyncStatus from '../components/EmailSyncStatus'
import { useEmailAccountSync } from './useEmailAccountSync'
import type { WebSessionMe } from '../lib/webAuth'

const startEmailBind = vi.fn()
vi.mock('../lib/webAuth', () => ({ startEmailBind: (email: string) => startEmailBind(email) }))

const refreshPremium = vi.fn()
const startWatch = vi.fn()
let setSessionFromTest: (s: WebSessionMe | null) => void = () => undefined

const guest: WebSessionMe = { ok: true, source: 'web_account', webAccountId: 'acc-guest' }

function Harness() {
  const [session, setSession] = useState<WebSessionMe | null>(guest)
  setSessionFromTest = setSession
  const sync = useEmailAccountSync({
    session,
    refreshSession: async () => session,
    refreshPremium,
    startEmailPendingWatch: startWatch,
    stopEmailPendingWatch: () => undefined,
  })
  return (
    <div>
      <button type="button" onClick={() => void sync.save('payer@example.com')}>
        Сохранить
      </button>
      <EmailSyncStatus phase={sync.phase} error={sync.error} email={sync.pendingEmail} />
    </div>
  )
}

async function save() {
  render(<Harness />)
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
  })
}

describe('profile email sync', () => {
  beforeEach(() => {
    startEmailBind.mockReset()
    refreshPremium.mockReset()
    startWatch.mockReset()
  })
  afterEach(() => cleanup())

  it('guest saves email: asks to confirm by link and does not show Premium before that', async () => {
    startEmailBind.mockResolvedValue({ ok: true, mode: 'verify_sent' })
    refreshPremium.mockResolvedValue({ isPremium: true })
    await save()
    expect(screen.getByText('Подтвердите почту по ссылке из письма')).toBeTruthy()
    expect(screen.getByText(/Письмо отправлено на payer@example.com/)).toBeTruthy()
    expect(refreshPremium).not.toHaveBeenCalled()
    expect(startWatch).toHaveBeenCalled()
  })

  it('paid account: link opened on another tab switches the session → "Premium восстановлен!"', async () => {
    startEmailBind.mockResolvedValue({ ok: true, mode: 'verify_sent' })
    refreshPremium.mockResolvedValue({ isPremium: true })
    await save()
    await act(async () => {
      setSessionFromTest({ ok: true, source: 'web_account', webAccountId: 'acc-paid', email: 'payer@example.com', emailVerified: true })
    })
    expect(refreshPremium).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Premium восстановлен!')).toBeTruthy()
  })

  it('new account without Premium: confirmed email → "Аккаунт готов к игре"', async () => {
    startEmailBind.mockResolvedValue({ ok: true, mode: 'verify_sent' })
    refreshPremium.mockResolvedValue({ isPremium: false })
    await save()
    await act(async () => {
      setSessionFromTest({ ...guest, email: 'payer@example.com', emailVerified: true })
    })
    expect(screen.getByText('Аккаунт готов к игре')).toBeTruthy()
  })

  it('an unrelated session refresh does not finish the flow', async () => {
    startEmailBind.mockResolvedValue({ ok: true, mode: 'verify_sent' })
    await save()
    await act(async () => {
      setSessionFromTest({ ...guest, displayName: 'Игрок' })
    })
    expect(screen.getByText('Подтвердите почту по ссылке из письма')).toBeTruthy()
    expect(refreshPremium).not.toHaveBeenCalled()
  })

  it('address already confirmed here: checks the subscription right away', async () => {
    startEmailBind.mockResolvedValue({ ok: true, mode: 'verified' })
    refreshPremium.mockResolvedValue({ isPremium: true })
    await save()
    expect(screen.getByText('Premium восстановлен!')).toBeTruthy()
    expect(startWatch).not.toHaveBeenCalled()
  })

  it('server refusal is shown as an error', async () => {
    startEmailBind.mockRejectedValue(Object.assign(new Error('x'), { status: 409, code: 'email_already_verified' }))
    await save()
    expect(screen.getByRole('alert').textContent).toMatch(/другая почта/)
  })
})