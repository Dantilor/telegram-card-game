/**
 * Fire-and-forget event tracking to backend.
 * Never logs initData, tokens, or payment identifiers.
 */

import { canSendAnalytics } from '../legal/analyticsGate'
import { legalApiBase } from '../legal/client'
import { getInitData } from './telegram'

const ALLOWED_PROPS: Record<string, string[]> = {
  app_open: [],
  start_game: ['gameId'],
  open_deck: ['deckId'],
  click_premium: [],
  yookassa_redirect: ['planId'],
}

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/

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

function allowedProps(name: string, props: Record<string, unknown> | undefined): Record<string, string> | undefined {
  const keys = ALLOWED_PROPS[name]
  if (!keys) return undefined
  if (!props) return undefined
  const out: Record<string, string> = {}
  for (const key of keys) {
    const value = props[key]
    if (typeof value !== 'string' || !IDENTIFIER.test(value)) continue
    out[key] = value
  }
  return Object.keys(out).length > 0 ? out : undefined
}

export function trackEvent(name: string, props?: Record<string, unknown>): void {
  const eventName = typeof name === 'string' ? name.trim() : ''
  if (!eventName || !Object.prototype.hasOwnProperty.call(ALLOWED_PROPS, eventName)) return
  if (!canSendAnalytics(eventName)) return

  let base = ''
  try {
    base = legalApiBase(import.meta.env)
  } catch {
    return
  }

  const eventProps = allowedProps(eventName, sanitizeProps(props))
  const body = JSON.stringify(eventProps ? { name: eventName, props: eventProps } : { name: eventName })
  const initData = getInitData()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (initData) headers['x-telegram-init-data'] = initData

  fetch(`${base}/api/events`, {
    method: 'POST',
    headers,
    body,
    credentials: 'omit',
  }).catch(() => {
    // fire-and-forget: ignore errors
  })
}
