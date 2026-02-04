import { getTg } from '../utils/telegram'
import { fetchJSON } from './client'

export type MeResponse = {
  telegramId: number
  premium: boolean
  premiumUntil?: string
}

export type PremiumStatusResponse = {
  isPremium: boolean
  activeUntil: string | null
}

export async function getMe(): Promise<MeResponse> {
  return fetchJSON<MeResponse>('/api/me', { method: 'GET' })
}

export async function getPremiumStatus(): Promise<PremiumStatusResponse> {
  return fetchJSON<PremiumStatusResponse>('/premium-status', { method: 'GET' })
}

export async function createInvoice(
  plan: 'month' | 'year'
): Promise<{ invoiceLink: string }> {
  return fetchJSON<{ invoiceLink: string }>('/api/invoice', {
    method: 'POST',
    body: JSON.stringify({ plan }),
  })
}

export function openInvoice(invoiceLink: string): void {
  const tg = getTg()
  tg?.openInvoice?.(invoiceLink, (status: string) => {
    if (status === 'paid') {
      window.dispatchEvent(new CustomEvent('tcg_premium_sync'))
    }
  })
  if (!tg?.openInvoice) {
    window.location.href = invoiceLink
  }
}
