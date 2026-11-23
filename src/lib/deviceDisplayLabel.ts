/** Human-readable WEB device label from User-Agent (display only, not auth). */

const PLACEHOLDER_RE =
  /^(current device|web device|web-устройство|текущее устройство|текущее устройство \(legacy\))$/i

export function isPlaceholderDeviceLabel(label: string | null | undefined): boolean {
  const raw = (label || '').trim()
  return !raw || PLACEHOLDER_RE.test(raw)
}

export function formatDeviceLabelFromUa(ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''): string {
  const value = String(ua || '')
  let platform = 'WEB-устройство'
  if (/iPad/i.test(value) || (navigator?.platform === 'MacIntel' && (navigator?.maxTouchPoints || 0) > 1)) {
    platform = 'iPad'
  } else if (/iPhone|iPod/i.test(value)) {
    platform = 'iPhone'
  } else if (/Android/i.test(value)) {
    platform = 'Android'
  } else if (/Windows/i.test(value)) {
    platform = 'Windows'
  } else if (/Mac OS X|Macintosh/i.test(value)) {
    platform = 'Mac'
  } else if (/Linux/i.test(value)) {
    platform = 'Linux'
  }

  let browser = ''
  if (/Edg\//i.test(value)) browser = 'Edge'
  else if (/OPR\/|Opera/i.test(value)) browser = 'Opera'
  else if (/YaBrowser/i.test(value)) browser = 'Яндекс'
  else if (/Firefox\//i.test(value)) browser = 'Firefox'
  else if (/Chrome\//i.test(value) && !/Edg\//i.test(value)) browser = 'Chrome'
  else if (/Safari\//i.test(value) && !/Chrome\//i.test(value)) browser = 'Safari'

  if (platform === 'WEB-устройство' && !browser) return 'WEB-устройство'
  if (!browser) return platform
  if (platform === 'WEB-устройство') return browser
  return `${platform} · ${browser}`
}

export function resolveDeviceDisplayLabel(
  label: string | null | undefined,
  opts: { isCurrent?: boolean; userAgent?: string } = {}
): string {
  if (!isPlaceholderDeviceLabel(label)) return String(label).trim()
  if (opts.isCurrent) return formatDeviceLabelFromUa(opts.userAgent)
  return 'WEB-устройство'
}