/**
 * Decide whether Metrika may start on the current address, and which advertising
 * query params (if any) are safe to keep for Direct attribution.
 *
 * Init sends location.href as page-url (nohit=1). Any non-allowlisted query/hash
 * therefore blocks the tag until the address is safe. Safe UTM/yclid stay in the
 * browser URL and may be mirrored into the first hit; they are never rewritten away
 * by this module.
 */

/** Exact allowlist for Yandex Direct / campaign measurement markers. */
export const METRIKA_SAFE_ADS_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'utm_id',
  'yclid',
  'ysclid',
] as const

const SAFE_ADS_SET = new Set<string>(METRIKA_SAFE_ADS_PARAMS)

/** Reject names that look like secrets / account / payment / room identifiers. */
const DANGEROUS_PARAM_NAME =
  /^(?:e?mail|token|code|otp|password|passwd|secret|session|sid|csrf|payment|order|room|hash|auth|recover|confirm|key|access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|telegram|phone|tel|card|cvv|cvc)(?:[_-].*)?$/i

/** Click ids: digits only. */
const CLICK_ID_VALUE = /^[0-9]{1,64}$/

/** UTM values: short, no email/token shapes; percent-encoding allowed. */
const UTM_VALUE = /^(?:[A-Za-z0-9._~-]|%[0-9A-Fa-f]{2}){1,200}$/

function isSafeAdsValue(name: string, value: string): boolean {
  if (!value || value.length > 200) return false
  if (value.includes('@') || value.includes('/') || value.includes('\\')) return false
  if (name === 'yclid' || name === 'ysclid') return CLICK_ID_VALUE.test(value)
  return UTM_VALUE.test(value)
}

export type MetrikaSearchVerdict =
  | { ok: true; adsSearch: string }
  | { ok: false; reason: 'hash' | 'dangerous_name' | 'unknown_param' | 'bad_value' | 'invalid' }

/**
 * Inspect a query string (with or without leading `?`) and optional hash.
 * Returns ok only when every param is an allowlisted ads marker with a safe value
 * (or there are no params). Hash is never allowed — room deep-links use it.
 */
export function inspectMetrikaSearch(search: string, hash = ''): MetrikaSearchVerdict {
  try {
    if (hash && hash !== '#' && hash.length > 0) return { ok: false, reason: 'hash' }

    const raw = search.startsWith('?') ? search.slice(1) : search
    if (!raw) return { ok: true, adsSearch: '' }

    const params = new URLSearchParams(raw)
    const kept = new URLSearchParams()
    const seen = new Set<string>()

    for (const [rawName, rawValue] of params.entries()) {
      const name = rawName.trim().toLowerCase()
      if (!name) return { ok: false, reason: 'invalid' }
      if (DANGEROUS_PARAM_NAME.test(name)) return { ok: false, reason: 'dangerous_name' }
      if (!SAFE_ADS_SET.has(name)) return { ok: false, reason: 'unknown_param' }
      if (!isSafeAdsValue(name, rawValue)) return { ok: false, reason: 'bad_value' }
      if (!seen.has(name)) {
        seen.add(name)
        kept.append(name, rawValue)
      }
    }

    const serialized = kept.toString()
    return { ok: true, adsSearch: serialized ? `?${serialized}` : '' }
  } catch {
    return { ok: false, reason: 'invalid' }
  }
}

/** True when Metrika may load/init on this address (empty or ads-only query, no hash). */
export function isMetrikaUrlSafe(search: string, hash = ''): boolean {
  return inspectMetrikaSearch(search, hash).ok
}

/**
 * Allowlisted ads query for the first hit URL, or empty if none / unsafe.
 * Callers must not invent params that were not already on the page.
 */
export function safeMetrikaAdsSearch(search: string, hash = ''): string {
  const verdict = inspectMetrikaSearch(search, hash)
  return verdict.ok ? verdict.adsSearch : ''
}