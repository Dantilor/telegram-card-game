/**
 * Minimal mail transport for WEB email OTP / transactional messages.
 * No marketing. Staging/local default: log-only test transport.
 */

export type MailMessage = {
  to: string
  subject: string
  text: string
}

export type MailTransport = {
  send(message: MailMessage): Promise<{ ok: true; transport: string }>
}

function smtpConfigured(): boolean {
  return Boolean(
    (process.env.SMTP_HOST || '').trim() &&
      (process.env.SMTP_FROM || '').trim() &&
      process.env.SMTP_ENABLED === '1'
  )
}

/** Dev/staging: never sends network mail; echoes to stdout (code never logged by callers). */
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

/**
 * Production-ready SMTP adapter using Node undici-less raw socket is out of scope;
 * when SMTP_ENABLED=1, require SMTP_URL or host/user/pass and use a simple HTTPS relay stub.
 * Without nodemailer dependency we only support test + optional webhook relay.
 */
export function createSmtpMailTransport(): MailTransport {
  const from = (process.env.SMTP_FROM || '').trim()
  const relayUrl = (process.env.SMTP_RELAY_URL || '').trim()
  if (!from) {
    throw new Error('SMTP_FROM required when SMTP_ENABLED=1')
  }
  if (!relayUrl) {
    // Fall back to test if misconfigured rather than crash cold start.
    console.warn('[mail] SMTP_ENABLED=1 but SMTP_RELAY_URL missing — using test transport')
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
  cached = smtpConfigured() ? createSmtpMailTransport() : createTestMailTransport()
  return cached
}

/** Test helper */
export function resetMailTransportCache(): void {
  cached = null
}
