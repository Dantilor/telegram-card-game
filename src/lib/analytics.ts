/**
 * Fire-and-forget event tracking to backend.
 * Never logs initData, tokens, or payment identifiers.
 */

import { getInitData } from './telegram'
import { getBaseUrl } from './api'

const SENSITIVE_KEYS = [
  'initData',
  'init_data',
  'token',
  'access_token',
  'charge_id',
  'provider_payment_charge_id',
  'telegram_payment_charge_id',
  'invoice_payload',
  'invoiceLink',
]

function sanitizeProps(props: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!props || typeof props !== 'object') return undefined
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(props)) {
    const lower = k.toLowerCase()
    if (SENSITIVE_KEYS.some((s) => lower.includes(s.toLowerCase()))) continue
    out[k] = v
  }
  return Object.keys(out).length > 0 ? out : undefined
}

export function trackEvent(name: string, props?: Record<string, unknown>): void {
  if (!name || typeof name !== 'string' || !name.trim()) return

  const sanitized = sanitizeProps(props)
  const body = JSON.stringify({ name: name.trim(), props: sanitized ?? undefined })

  const initData = getInitData()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (initData) headers['x-telegram-init-data'] = initData

  const url = `${getBaseUrl()}/api/events`
  fetch(url, {
    method: 'POST',
    headers,
    body,
    credentials: 'omit',
  }).catch(() => {
    // fire-and-forget: ignore errors
  })
}
