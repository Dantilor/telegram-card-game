/**
 * WEB-only Metrika consent (local).
 * Separate from first-party /api/events analyticsGate, which stays off until a server grant is wired.
 * Privacy §8.12: cookie/identifier tracking needs disclosure + consent before processing.
 */

export type MetrikaConsentState = 'unknown' | 'granted' | 'denied'

// New key: historical test flags never count as consent to the new published policy.
const STORAGE_KEY = 'gnh_metrika_consent_v2'
const EVENT = 'gnh:metrika-consent'

function readRaw(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function getMetrikaConsent(): MetrikaConsentState {
  const raw = readRaw()
  if (raw === 'granted') return 'granted'
  if (raw === 'denied') return 'denied'
  return 'unknown'
}

export function setMetrikaConsent(state: 'granted' | 'denied'): void {
  try {
    localStorage.setItem(STORAGE_KEY, state)
  } catch {
    /* private mode — still notify in-memory listeners via event */
  }
  try {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: state }))
  } catch {
    /* ignore */
  }
}

export function clearMetrikaConsent(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: 'unknown' }))
  } catch {
    /* ignore */
  }
}

export function subscribeMetrikaConsent(listener: (state: MetrikaConsentState) => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return
    listener(getMetrikaConsent())
  }
  const onCustom = () => listener(getMetrikaConsent())
  window.addEventListener('storage', onStorage)
  window.addEventListener(EVENT, onCustom)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(EVENT, onCustom)
  }
}

export function isMetrikaConsentGranted(): boolean {
  return getMetrikaConsent() === 'granted'
}