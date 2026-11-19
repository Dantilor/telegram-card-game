const STORAGE_KEY = 'gnh_web_display_name_v1'
const MAX_LEN = 40

/** Sanitize optional local WEB display name (device-only, no DB). */
export function sanitizeWebDisplayName(raw: string): string {
  return String(raw ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_LEN)
}

export function readWebDisplayName(): string {
  try {
    if (typeof localStorage === 'undefined') return ''
    return sanitizeWebDisplayName(localStorage.getItem(STORAGE_KEY) || '')
  } catch {
    return ''
  }
}

export function writeWebDisplayName(raw: string): string {
  const next = sanitizeWebDisplayName(raw)
  try {
    if (typeof localStorage === 'undefined') return next
    if (!next) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* private mode */
  }
  return next
}
