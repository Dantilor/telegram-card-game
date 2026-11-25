/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  PENDING_PAYMENT_TTL_MS,
  clearPendingWebPayment,
  markPendingWebPaymentReturned,
  readPendingWebPayment,
  savePendingWebPayment,
} from './pendingWebPayment'

describe('pending WEB payment storage', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  it('stores only the payment id, the WEB account id and timestamps', () => {
    expect(savePendingWebPayment('2c9a1b3d-000f-5000-9000-1abcdef01234', 'acc-uuid-1', 1_000)).toBe(true)
    const raw = sessionStorage.getItem('gnh_web_pending_payment')!
    expect(Object.keys(JSON.parse(raw)).sort()).toEqual(['accountId', 'createdAt', 'paymentId'])
    expect(readPendingWebPayment(2_000)).toEqual({
      paymentId: '2c9a1b3d-000f-5000-9000-1abcdef01234',
      accountId: 'acc-uuid-1',
      createdAt: 1_000,
    })
  })

  it('expires and removes an old order', () => {
    savePendingWebPayment('pay-12345678', null, 1_000)
    expect(readPendingWebPayment(1_000 + PENDING_PAYMENT_TTL_MS - 1)?.paymentId).toBe('pay-12345678')
    expect(readPendingWebPayment(1_000 + PENDING_PAYMENT_TTL_MS + 1)).toBeNull()
    expect(sessionStorage.getItem('gnh_web_pending_payment')).toBeNull()
  })

  it('rejects malformed ids and garbage', () => {
    expect(savePendingWebPayment("x'; DROP TABLE web_payments;--", 'a')).toBe(false)
    expect(savePendingWebPayment('short', 'a')).toBe(false)
    sessionStorage.setItem('gnh_web_pending_payment', '{not json')
    expect(readPendingWebPayment()).toBeNull()
  })

  it('marks the return once and survives a reload; clear removes both copies', () => {
    savePendingWebPayment('pay-12345678', 'acc-1', 1_000)
    expect(markPendingWebPaymentReturned(2_000)?.returnedAt).toBe(2_000)
    expect(markPendingWebPaymentReturned(5_000)?.returnedAt).toBe(2_000)
    expect(readPendingWebPayment(6_000)?.returnedAt).toBe(2_000)
    clearPendingWebPayment()
    expect(readPendingWebPayment(6_000)).toBeNull()
    expect(localStorage.getItem('gnh_web_pending_payment')).toBeNull()
  })

  it('finds the order in another tab through the localStorage copy', () => {
    savePendingWebPayment('pay-12345678', 'acc-1')
    sessionStorage.clear()
    expect(readPendingWebPayment()?.paymentId).toBe('pay-12345678')
  })
})