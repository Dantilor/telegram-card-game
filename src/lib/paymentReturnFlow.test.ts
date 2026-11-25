import { describe, expect, it, vi } from 'vitest'
import type { ConfirmOutcome } from './confirmWebPayment'
import type { PendingWebPayment } from './pendingWebPayment'
import { runPaymentReturnFlow, type PaymentReturnDeps, type PaymentReturnPhase } from './paymentReturnFlow'

const PENDING: PendingWebPayment = { paymentId: 'pay-12345678', accountId: 'acc-1', createdAt: Date.now(), returnedAt: Date.now() }

function setup(opts: {
  pending?: PendingWebPayment | null
  outcomes?: ConfirmOutcome[]
  account?: string | null | Error
  premium?: boolean[]
  attempts?: number
}) {
  const outcomes = [...(opts.outcomes ?? [])]
  const premium = [...(opts.premium ?? [true])]
  const phases: PaymentReturnPhase[] = []
  const deps = {
    readPending: vi.fn(() => (opts.pending === undefined ? PENDING : opts.pending)),
    clearPending: vi.fn(),
    confirm: vi.fn(async () => outcomes.shift() ?? ({ kind: 'temporary' } as ConfirmOutcome)),
    currentAccountId: vi.fn(async () => {
      if (opts.account instanceof Error) throw opts.account
      return opts.account === undefined ? 'acc-1' : opts.account
    }),
    refreshPremium: vi.fn(async () => ({ isPremium: premium.length > 1 ? premium.shift()! : premium[0]! })),
    sleep: vi.fn(async () => undefined),
    isActive: () => true,
    onPhase: (p: PaymentReturnPhase) => phases.push(p),
    attempts: opts.attempts ?? 5,
    intervalMs: 1,
  } satisfies PaymentReturnDeps
  return { deps, phases }
}

const confirmed: ConfirmOutcome = { kind: 'confirmed', activeUntil: '2027-01-01T00:00:00.000Z', alreadyDone: false }

describe('payment return flow', () => {
  it('confirm before the webhook: forces /api/me, shows success and clears the pending order', async () => {
    const { deps, phases } = setup({ outcomes: [confirmed] })
    expect(await runPaymentReturnFlow(deps)).toBe('success')
    expect(deps.confirm).toHaveBeenCalledWith('pay-12345678')
    expect(deps.refreshPremium).toHaveBeenCalled()
    expect(deps.clearPending).toHaveBeenCalledTimes(1)
    expect(phases[0]).toBe('checking')
    expect(phases.at(-1)).toBe('success')
  })

  it('webhook earlier than the return: confirm reports alreadyDone and still succeeds', async () => {
    const { deps } = setup({ outcomes: [{ ...confirmed, alreadyDone: true }] })
    expect(await runPaymentReturnFlow(deps)).toBe('success')
    expect(deps.confirm).toHaveBeenCalledTimes(1)
    expect(deps.clearPending).toHaveBeenCalledTimes(1)
  })

  it('repeated confirm is harmless: a second run with the order kept succeeds again without a payment', async () => {
    const first = setup({ outcomes: [confirmed], premium: [false, false, false] })
    // /api/me did not show Premium yet -> the order is kept for a re-check.
    expect(await runPaymentReturnFlow(first.deps)).toBe('error')
    expect(first.deps.clearPending).not.toHaveBeenCalled()
    const second = setup({ outcomes: [{ ...confirmed, alreadyDone: true }] })
    expect(await runPaymentReturnFlow(second.deps)).toBe('success')
  })

  it('pending then succeeded: keeps polling with a bounded interval', async () => {
    const { deps } = setup({
      outcomes: [{ kind: 'pending', status: 'pending' }, { kind: 'pending', status: 'pending' }, confirmed],
    })
    expect(await runPaymentReturnFlow(deps)).toBe('success')
    expect(deps.confirm).toHaveBeenCalledTimes(3)
    expect(deps.sleep).toHaveBeenCalledTimes(2)
  })

  it('still pending after the attempt limit: asks the user to re-check, keeps the order', async () => {
    const { deps } = setup({ outcomes: Array(5).fill({ kind: 'pending', status: 'pending' }), attempts: 5 })
    expect(await runPaymentReturnFlow(deps)).toBe('pending')
    expect(deps.confirm).toHaveBeenCalledTimes(5)
    expect(deps.clearPending).not.toHaveBeenCalled()
  })

  it('lost session: no session or another account never calls confirm or invents Premium', async () => {
    for (const account of [null, 'acc-other']) {
      const { deps } = setup({ account })
      expect(await runPaymentReturnFlow(deps)).toBe('session_lost')
      expect(deps.confirm).not.toHaveBeenCalled()
      expect(deps.refreshPremium).not.toHaveBeenCalled()
      expect(deps.clearPending).not.toHaveBeenCalled()
    }
  })

  it("someone else's paymentId (403) or a missing CSRF (401) ends as session_lost, never a grant", async () => {
    const { deps } = setup({ outcomes: [{ kind: 'session_lost' }] })
    expect(await runPaymentReturnFlow(deps)).toBe('session_lost')
    expect(deps.confirm).toHaveBeenCalledTimes(1)
    expect(deps.refreshPremium).not.toHaveBeenCalled()
  })

  it('YooKassa/API errors are retried, then reported as a temporary error; the order is kept', async () => {
    const { deps } = setup({ outcomes: Array(5).fill({ kind: 'temporary' }), attempts: 5 })
    expect(await runPaymentReturnFlow(deps)).toBe('error')
    expect(deps.confirm).toHaveBeenCalledTimes(5)
    expect(deps.clearPending).not.toHaveBeenCalled()
    // "Проверить ещё раз": the provider is back.
    const retry = setup({ outcomes: [confirmed] })
    expect(await runPaymentReturnFlow(retry.deps)).toBe('success')
  })

  it('a transient error in the middle recovers on the next attempt', async () => {
    const { deps } = setup({ outcomes: [{ kind: 'temporary' }, confirmed] })
    expect(await runPaymentReturnFlow(deps)).toBe('success')
  })

  it('rejected payments (amount/plan mismatch) stop immediately without a retry loop', async () => {
    const { deps } = setup({ outcomes: [{ kind: 'rejected', code: 'amount_mismatch' }] })
    expect(await runPaymentReturnFlow(deps)).toBe('failed')
    expect(deps.confirm).toHaveBeenCalledTimes(1)
    expect(deps.clearPending).not.toHaveBeenCalled()
  })

  it('canceled payment clears the order and offers a new checkout', async () => {
    const { deps } = setup({ outcomes: [{ kind: 'canceled' }] })
    expect(await runPaymentReturnFlow(deps)).toBe('canceled')
    expect(deps.clearPending).toHaveBeenCalledTimes(1)
    expect(deps.refreshPremium).not.toHaveBeenCalled()
  })

  it('unknown order on the server drops the stale record and only trusts /api/me', async () => {
    const stale = setup({ outcomes: [{ kind: 'not_found' }], premium: [false] })
    expect(await runPaymentReturnFlow(stale.deps)).toBe('failed')
    expect(stale.deps.clearPending).toHaveBeenCalled()
    const already = setup({ outcomes: [{ kind: 'not_found' }], premium: [true] })
    expect(await runPaymentReturnFlow(already.deps)).toBe('success')
  })

  it('a session lookup failure does not block the authoritative confirm call', async () => {
    const { deps } = setup({ account: new Error('network'), outcomes: [confirmed] })
    expect(await runPaymentReturnFlow(deps)).toBe('success')
  })

  it('no stored order (another browser): polls /api/me for the webhook, never calls confirm', async () => {
    const hit = setup({ pending: null, premium: [false, false, true] })
    expect(await runPaymentReturnFlow(hit.deps)).toBe('success')
    expect(hit.deps.confirm).not.toHaveBeenCalled()
    expect(hit.deps.refreshPremium).toHaveBeenCalledTimes(3)

    const miss = setup({ pending: null, premium: [false], attempts: 4 })
    expect(await runPaymentReturnFlow(miss.deps)).toBe('session_lost')
    expect(miss.deps.refreshPremium).toHaveBeenCalledTimes(4)
  })

  it('stops quietly when the page is gone', async () => {
    const { deps } = setup({ outcomes: [{ kind: 'pending', status: 'pending' }] })
    let active = true
    deps.isActive = () => active
    deps.sleep = vi.fn(async () => {
      active = false
    })
    expect(await runPaymentReturnFlow(deps)).toBe('idle')
    expect(deps.confirm).toHaveBeenCalledTimes(1)
  })
})