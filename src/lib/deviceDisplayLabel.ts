/** Display-only device label helpers for Mini App (not auth). */
const PLACEHOLDER_RE =
  /^(current device|web device|web-устройство|текущее устройство)$/i

export function resolveMiniAppDeviceLabel(label: string | null | undefined): string {
  const raw = (label || '').trim()
  if (!raw || PLACEHOLDER_RE.test(raw)) return 'WEB-устройство'
  return raw
}