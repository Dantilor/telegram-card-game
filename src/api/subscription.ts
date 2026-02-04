import { getTg } from '../utils/telegram'
import { apiGet, apiPost } from '../lib/api'

export type MeResponse = {
  telegramId: number
  premium: boolean
  premiumUntil?: string
}

export type PremiumStatusResponse = {
  isPremium: boolean
  activeUntil: string | null
}

export class ApiAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiAuthError'
  }
}

export async function getMe(): Promise<MeResponse> {
  try {
    return await apiGet<MeResponse>('/api/me')
  } catch (e) {
    const err = e as Error & { status?: number }
    if (err.status === 401) {
      throw new ApiAuthError('Не удалось подтвердить Telegram initData')
    }
    throw e
  }
}

export async function getPremiumStatus(): Promise<PremiumStatusResponse> {
  const me = await getMe()
  return {
    isPremium: me.premium,
    activeUntil: me.premiumUntil ?? null,
  }
}

export async function createInvoice(
  plan: 'month' | 'year'
): Promise<{ invoiceLink: string }> {
  return apiPost<{ invoiceLink: string }>('/api/invoice', { plan })
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
