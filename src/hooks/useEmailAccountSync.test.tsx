/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import EmailSyncStatus from '../components/EmailSyncStatus'
import { useEmailAccountSync } from './useEmailAccountSync'
import type { WebSessionMe } from '../lib/webAuth'

const saveProfileContactEmail = vi.fn()
const startEmailBind = vi.fn()
vi.mock('../lib/webAuth', () => ({
  saveProfileContactEmail: (email: string) => saveProfileContactEmail(email),
  startEmailBind: (email: string) => startEmailBind(email),
}))

const refreshPremium = vi.fn()
const startWatch = vi.fn()
let updateSession: (s: WebSessionMe | null) => void = () => undefined
const guest: WebSessionMe = { ok: true, source: 'web_account', webAccountId: 'acc-guest' }

function Harness() {
  const [session, setSession] = useState<WebSessionMe | null>(guest)
  updateSession = setSession
  const sync = useEmailAccountSync({
    session,
    refreshSession: async () => session,
    refreshPremium,
    startEmailPendingWatch: startWatch,
    stopEmailPendingWatch: () => undefined,
  })
  return (
    <div>
      <button type="button" onClick={() => void sync.save('payer@example.com')}>Сохранить</button>
      <EmailSyncStatus phase={sync.phase} error={sync.error} email={sync.pendingEmail} />
    </div>
  )
}
async function save() {
  render(<Harness />)
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Сохранить' })) })
}

describe('Profile: save email and restore Premium without extra recovery button', () => {
  beforeEach(() => {
    saveProfileContactEmail.mockReset()
    startEmailBind.mockReset()
    refreshPremium.mockReset()
    startWatch.mockReset()
    saveProfileContactEmail.mockResolvedValue({ mode: 'saved' })
    startEmailBind.mockResolvedValue({ mode: 'verify_sent' })
  })
  afterEach(() => cleanup())

  it('current browser already Premium: saved immediately without email link', async () => {
    refreshPremium.mockResolvedValue({ isPremium: true })
    await save()
    expect(screen.getByText('Premium активен!')).toBeTruthy()
    expect(startEmailBind).not.toHaveBeenCalled()
    expect(startWatch).not.toHaveBeenCalled()
  })

  it('Premium bought elsewhere: same Save click triggers email link', async () => {
    refreshPremium.mockResolvedValueOnce({ isPremium: false }).mockResolvedValue({ isPremium: true })
    await save()
    expect(saveProfileContactEmail).toHaveBeenCalledWith('payer@example.com')
    expect(startEmailBind).toHaveBeenCalledWith('payer@example.com')
    expect(screen.getByText('Подтвердите почту по ссылке из письма')).toBeTruthy()
    expect(startWatch).toHaveBeenCalled()
    await act(async () => {
      updateSession({ ...guest, email: 'payer@example.com', emailVerified: true })
    })
    expect(refreshPremium).toHaveBeenCalledTimes(2)
    expect(screen.getByText('Premium активен!')).toBeTruthy()
  })

  it('no purchase: link confirms email, then shows free account', async () => {
    refreshPremium.mockResolvedValue({ isPremium: false })
    await save()
    expect(screen.getByText('Подтвердите почту по ссылке из письма')).toBeTruthy()
    await act(async () => {
      updateSession({ ...guest, email: 'payer@example.com', emailVerified: true })
    })
    expect(screen.getByText('Аккаунт готов к игре')).toBeTruthy()
  })

  it('SMTP error after saving email: visible error, no fake Premium', async () => {
    refreshPremium.mockResolvedValue({ isPremium: false })
    startEmailBind.mockRejectedValueOnce(new Error('smtp'))
    await save()
    expect(screen.getByRole('alert').textContent).toMatch(/отправить ссылку/)
  })
})
