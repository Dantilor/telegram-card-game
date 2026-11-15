/**
 * Mail transport for WEB email OTP / transactional messages.
 * No marketing. Production must not silently fall back to test transport.
 */

export type MailMessage = {
  to: string
  subject: string
  text: string
}

export type MailTransport = {
  send(message: MailMessage): Promise<{ ok: true; transport: string }>
}

function isProductionLike(): boolean {
  if (process.env.NODE_ENV === 'production') return true
  if (process.env.GNH_PRODUCTION === '1' || process.env.GNH_PRODUCTION === 'true') return true
  if (process.env.TIMEWEB === '1' || process.env.TIMEWEB === 'true') return true
  return false
}

function smtpConfigured(): boolean {
  return Boolean(
    (process.env.SMTP_FROM || '').trim() &&
      process.env.SMTP_ENABLED === '1' &&
      ((process.env.SMTP_RELAY_URL || '').trim() || (process.env.SMTP_HOST || '').trim())
  )
}

/** Dev/staging: never sends network mail. */
export function createTestMailTransport(): MailTransport {
  return {
    async send(message) {
      console.log('[mail:test]', {
        to: message.to.replace(/(^.).*(@.*$)/, '$1***$2'),
        subject: message.subject,
        textLen: message.text.length,
      })
      return { ok: true, transport: 'test' }
    },
  }
}

export function createSmtpMailTransport(opts?: { allowTestFallback?: boolean }): MailTransport {
  const from = (process.env.SMTP_FROM || '').trim()
  const relayUrl = (process.env.SMTP_RELAY_URL || '').trim()
  if (!from) {
    throw new Error('SMTP_FROM required when SMTP_ENABLED=1')
  }
  if (!relayUrl) {
    if (opts?.allowTestFallback === false || isProductionLike()) {
      throw new Error('SMTP_RELAY_URL required in production')
    }
    console.warn('[mail] SMTP_ENABLED=1 but SMTP_RELAY_URL missing — using test transport (non-prod)')
    return createTestMailTransport()
  }
  return {
    async send(message) {
      const res = await fetch(relayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.SMTP_RELAY_TOKEN
            ? { Authorization: `Bearer ${process.env.SMTP_RELAY_TOKEN}` }
            : {}),
        },
        body: JSON.stringify({
          from,
          to: message.to,
          subject: message.subject,
          text: message.text,
        }),
      })
      if (!res.ok) {
        throw new Error(`smtp_relay_${res.status}`)
      }
      return { ok: true, transport: 'smtp_relay' }
    },
  }
}

let cached: MailTransport | null = null

export function getMailTransport(): MailTransport {
  if (cached) return cached
  if (isProductionLike()) {
    if (!smtpConfigured()) {
      throw new Error('SMTP must be configured in production (SMTP_ENABLED, SMTP_FROM, SMTP_RELAY_URL)')
    }
    cached = createSmtpMailTransport({ allowTestFallback: false })
    return cached
  }
  cached = smtpConfigured()
    ? createSmtpMailTransport({ allowTestFallback: true })
    : createTestMailTransport()
  return cached
}

/** Test helper */
export function resetMailTransportCache(): void {
  cached = null
}
