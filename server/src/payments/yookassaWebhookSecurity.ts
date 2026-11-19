/**
 * YooKassa HTTP notification authenticity helpers.
 *
 * Official Basic Auth shops do NOT send a custom Authorization Bearer on webhooks.
 * Authenticity comes from: (1) authenticated GET /v3/payments|refunds/{id},
 * (2) optional IP allowlist (official YooKassa ranges), (3) optional custom Bearer
 * only when the operator explicitly enables REQUIRE_SECRET or sends Authorization.
 */

import { isIP } from 'node:net'
import { clientIpFromRequest } from '../auth/rateLimit.js'

/** Official notification source ranges (YooKassa docs). */
export const YOOKASSA_NOTIFICATION_IP_RANGES = [
  '185.71.76.0/27',
  '185.71.77.0/27',
  '77.75.153.0/25',
  '77.75.154.128/25',
  '77.75.156.11',
  '77.75.156.35',
  '2a02:5180::/32',
] as const

type IpV4Parts = [number, number, number, number]

function parseIpv4(ip: string): IpV4Parts | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  const nums = parts.map((p) => Number.parseInt(p, 10))
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null
  return nums as IpV4Parts
}

function ipv4ToInt(parts: IpV4Parts): number {
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]
}

function ipv4InCidr(ip: string, cidr: string): boolean {
  const [base, bitsRaw] = cidr.split('/')
  const bits = Number.parseInt(bitsRaw ?? '', 10)
  if (!base || !Number.isInteger(bits) || bits < 0 || bits > 32) return false
  const ipParts = parseIpv4(ip)
  const baseParts = parseIpv4(base)
  if (!ipParts || !baseParts) return false
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
  return (ipv4ToInt(ipParts) & mask) === (ipv4ToInt(baseParts) & mask)
}

function normalizeIp(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.startsWith('::ffff:')) return trimmed.slice(7)
  return trimmed
}

/** True when ip is in an official YooKassa notification range. */
export function isYookassaNotificationIp(
  ipRaw: string,
  ranges: readonly string[] = YOOKASSA_NOTIFICATION_IP_RANGES
): boolean {
  const ip = normalizeIp(ipRaw)
  if (!ip || ip === 'unknown') return false
  const version = isIP(ip)
  if (!version) return false

  for (const range of ranges) {
    if (range.includes('/')) {
      if (version === 4 && ipv4InCidr(ip, range)) return true
      if (
        version === 6 &&
        range.toLowerCase().startsWith('2a02:5180::/') &&
        ip.toLowerCase().startsWith('2a02:5180:')
      ) {
        return true
      }
      continue
    }
    if (normalizeIp(range) === ip) return true
  }
  return false
}

export type WebhookAuthDecision =
  | { ok: true; mode: 'api_verify' | 'bearer_ok' }
  | { ok: false; reason: 'bearer_required' | 'bearer_mismatch' }

/**
 * Authorization policy for POST /api/yookassa/webhook.
 *
 * - Default / staging TEST: no Bearer required (standard YooKassa HTTP notifications).
 * - If Authorization is present and YOOKASSA_WEBHOOK_SECRET is set -> must match.
 * - YOOKASSA_WEBHOOK_REQUIRE_SECRET=1 -> legacy custom gate; Bearer required.
 */
export function evaluateYookassaWebhookAuth(
  req: { headers: Record<string, unknown> | { authorization?: unknown } },
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): WebhookAuthDecision {
  const secret = String(env.YOOKASSA_WEBHOOK_SECRET ?? '').trim()
  const requireSecret =
    env.YOOKASSA_WEBHOOK_REQUIRE_SECRET === '1' || env.YOOKASSA_WEBHOOK_REQUIRE_SECRET === 'true'

  const headers = req.headers as { authorization?: unknown; Authorization?: unknown }
  const authRaw = String(headers.authorization ?? headers.Authorization ?? '').trim()
  const authPresent = authRaw.length > 0
  const auth = authRaw.toLowerCase().startsWith('bearer ') ? authRaw.slice(7).trim() : authRaw

  if (requireSecret) {
    if (!secret || !authPresent || auth !== secret) {
      return { ok: false, reason: secret && authPresent ? 'bearer_mismatch' : 'bearer_required' }
    }
    return { ok: true, mode: 'bearer_ok' }
  }

  // Standard YooKassa path: missing Authorization is expected.
  if (!authPresent) {
    return { ok: true, mode: 'api_verify' }
  }

  // Optional custom Authorization (proxy / local mock): validate when secret configured.
  if (secret) {
    if (auth !== secret) return { ok: false, reason: 'bearer_mismatch' }
    return { ok: true, mode: 'bearer_ok' }
  }

  // Authorization sent but no secret configured - ignore header, rely on API verify.
  return { ok: true, mode: 'api_verify' }
}

export function yookassaWebhookIpCheckEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  return env.YOOKASSA_WEBHOOK_IP_CHECK === '1' || env.YOOKASSA_WEBHOOK_IP_CHECK === 'true'
}

/**
 * Optional IP gate. Uses Express req.ip (TRUST_PROXY / Timeweb).
 * When check is disabled, always allows.
 */
export function evaluateYookassaWebhookIp(
  req: { ip?: string; socket?: { remoteAddress?: string } },
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): { ok: true; ip: string; checked: boolean } | { ok: false; ip: string; checked: true } {
  const ip = clientIpFromRequest(req)
  if (!yookassaWebhookIpCheckEnabled(env)) {
    return { ok: true, ip, checked: false }
  }
  if (isYookassaNotificationIp(ip)) {
    return { ok: true, ip, checked: true }
  }
  return { ok: false, ip, checked: true }
}
