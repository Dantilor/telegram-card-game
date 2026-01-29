import { getTg } from '../utils/telegram'
import { fetchJSON } from './client'

export type MeResponse = {
  telegramId: number
  premium: boolean
  premiumUntil?: string
}

export async function getMe(): Promise<MeResponse> {
  return fetchJSON<MeResponse>('/api/me', { method: 'GET' })
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
  if (tg?.openInvoice) {
    tg.openInvoice(invoiceLink, (status) => {
      if (status === 'paid') {
        window.dispatchEvent(new CustomEvent('tcg_premium_sync'))
      }
    })
  } else {
    window.location.href = invoiceLink
  }
}
