/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import EmailSyncStatus from '../components/EmailSyncStatus'
import { useEmailAccountSync } from './useEmailAccountSync'
import type { WebSessionMe } from '../lib/webAuth'

const saveProfileContactEmail = vi.fn()
vi.mock('../lib/webAuth', () => ({ saveProfileContactEmail: (email: string) => saveProfileContactEmail(email) }))

const refreshPremium = vi.fn()
const startWatch = vi.fn()
const guest: WebSessionMe = { ok: true, source: 'web_account', webAccountId: 'acc-guest' }

function Harness() {
  const sync = useEmailAccountSync({
    session: guest,
    refreshSession: async () => guest,
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

describe('profile email save without mandatory mail', () => {
  beforeEach(() => { saveProfileContactEmail.mockReset(); refreshPremium.mockReset(); startWatch.mockReset() })
  afterEach(() => cleanup())

  it('paid browser: saves email and shows existing Premium immediately', async () => {
    saveProfileContactEmail.mockResolvedValue({ ok: true, mode: 'saved' })
    refreshPremium.mockResolvedValue({ isPremium: true })
    await save()
    expect(screen.getByText('Premium активен!')).toBeTruthy()
    expect(refreshPremium).toHaveBeenCalledTimes(1)
    expect(startWatch).not.toHaveBeenCalled()
  })

  it('free browser: saves contact but never fabricates another account Premium', async () => {
    saveProfileContactEmail.mockResolvedValue({ ok: true, mode: 'saved' })
    refreshPremium.mockResolvedValue({ isPremium: false })
    await save()
    expect(screen.getByText('Аккаунт готов к игре')).toBeTruthy()
    expect(startWatch).not.toHaveBeenCalled()
  })

  it('existing verified email checks Premium immediately', async () => {
    saveProfileContactEmail.mockResolvedValue({ ok: true, mode: 'verified' })
    refreshPremium.mockResolvedValue({ isPremium: true })
    await save()
    expect(screen.getByText('Premium активен!')).toBeTruthy()
  })

  it('server refusal is visible', async () => {
    saveProfileContactEmail.mockRejectedValue(Object.assign(new Error('x'), { status: 409, code: 'email_already_verified' }))
    await save()
    expect(screen.getByRole('alert').textContent).toMatch(/другая почта/)
  })
})
