import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiPost = vi.fn()
vi.mock('./api', () => ({ apiPost: (...a: unknown[]) => apiPost(...a) }))

const httpError = (status: number, text = '') => Object.assign(new Error(`API ${status}: ${text}`), { status })

describe('confirmWebPayment', () => {
  beforeEach(() => apiPost.mockReset())

  it('posts only the payment id to the authenticated confirm endpoint', async () => {
    apiPost.mockResolvedValue({ ok: true, alreadyDone: false, activeUntil: '2027-01-01T00:00:00.000Z' })
    const { confirmWebPayment } = await import('./confirmWebPayment')
    expect(await confirmWebPayment('pay-12345678')).toEqual({
      kind: 'confirmed',
      activeUntil: '2027-01-01T00:00:00.000Z',
      alreadyDone: false,
    })
    expect(apiPost).toHaveBeenCalledWith('/api/yookassa/confirm', { paymentId: 'pay-12345678' })
  })

  it('maps provider and HTTP outcomes', async () => {
    const { confirmWebPayment } = await import('./confirmWebPayment')
    apiPost.mockResolvedValueOnce({ ok: false, status: 'pending' })
    expect(await confirmWebPayment('p')).toEqual({ kind: 'pending', status: 'pending' })
    apiPost.mockResolvedValueOnce({ ok: false, status: 'canceled' })
    expect(await confirmWebPayment('p')).toEqual({ kind: 'canceled' })
    apiPost.mockRejectedValueOnce(httpError(401))
    expect(await confirmWebPayment('p')).toEqual({ kind: 'session_lost' })
    apiPost.mockRejectedValueOnce(httpError(403, '{"error":"payment_owner_mismatch"}'))
    expect(await confirmWebPayment('p')).toEqual({ kind: 'session_lost' })
    apiPost.mockRejectedValueOnce(httpError(404))
    expect(await confirmWebPayment('p')).toEqual({ kind: 'not_found' })
    for (const status of [429, 500, 502, 503]) {
      apiPost.mockRejectedValueOnce(httpError(status))
      expect(await confirmWebPayment('p')).toEqual({ kind: 'temporary' })
    }
    apiPost.mockRejectedValueOnce(new Error('Сеть недоступна: Failed to fetch'))
    expect(await confirmWebPayment('p')).toEqual({ kind: 'temporary' })
    apiPost.mockRejectedValueOnce(httpError(400, '{"ok":false,"error":"amount_mismatch"}'))
    expect(await confirmWebPayment('p')).toEqual({ kind: 'rejected', code: 'amount_mismatch' })
  })
})