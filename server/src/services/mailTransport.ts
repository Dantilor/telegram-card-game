/**
 * Mail transport for WEB email magic-link / transactional messages.
 * No marketing. Production must not silently fall back to test transport.
 *
 * Modes:
 * - smtp      — direct Nodemailer SMTP (Timeweb smtp.timeweb.ru:465)
 * - smtp_relay — HTTP JSON relay (legacy / alternate)
 * - test      — log-only (non-production)
 */

import nodemailer from 'nodemailer'
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js'
import { isProductionLikeRuntime } from '../config/runtimeFlags.js'

export type MailMessage = {
  to: string
  subject: string
  text: string
  html?: string
}

export type MailTransport = {
  send(message: MailMessage): Promise<{ ok: true; transport: string }>
}

export type MailTransportMode = 'smtp' | 'smtp_relay' | 'test'

export type SmtpConfigDiagnosis = {
  ok: boolean
  mode: MailTransportMode | 'unconfigured' | 'conflict'
  productionLike: boolean
  smtpEnabled: boolean
  fromConfigured: boolean
  relayConfigured: boolean
  directSmtpConfigured: boolean
  host: string | null
  port: number | null
  secure: boolean | null
  userConfigured: boolean
  passwordConfigured: boolean
  tlsRejectUnauthorized: true
  issues: string[]
}

type NodemailerSendMail = (mail: {
  from: string
  to: string
  subject: string
  text: string
  html?: string
}) => Promise<unknown>

type NodemailerTransportLike = {
  sendMail: NodemailerSendMail
  verify?: () => Promise<true>
}

type NodemailerFactory = (options: SMTPTransport.Options) => NodemailerTransportLike

let nodemailerFactory: NodemailerFactory = (options) =>
  nodemailer.createTransport(options) as NodemailerTransportLike

/** Test helper: inject a mock createTransport. Pass null to restore. */
export function setNodemailerFactoryForTests(factory: NodemailerFactory | null): void {
  nodemailerFactory = factory ?? ((options) => nodemailer.createTransport(options) as NodemailerTransportLike)
}

function trimEnv(name: string): string {
  return (process.env[name] || '').trim()
}

function parsePort(raw: string): number | null {
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0 || n > 65535) return null
  return Math.floor(n)
}

function parseSecure(port: number | null): boolean {
  const raw = trimEnv('SMTP_SECURE').toLowerCase()
  if (raw === 'true' || raw === '1' || raw === 'yes') return true
  if (raw === 'false' || raw === '0' || raw === 'no') return false
  // Timeweb / SMTPS default: 465 → TLS from connect
  return port === 465
}

function relayConfigured(): boolean {
  return Boolean(trimEnv('SMTP_RELAY_URL'))
}

function directSmtpConfigured(): boolean {
  return Boolean(
    trimEnv('SMTP_HOST') &&
      trimEnv('SMTP_USER') &&
      trimEnv('SMTP_PASSWORD') &&
      parsePort(trimEnv('SMTP_PORT') || '465')
  )
}

function smtpEnabled(): boolean {
  return process.env.SMTP_ENABLED === '1'
}

function fromConfigured(): boolean {
  return Boolean(trimEnv('SMTP_FROM'))
}

/** Preferred transport when both relay and direct SMTP look complete. */
function transportPreference(): 'auto' | 'smtp' | 'relay' {
  const raw = trimEnv('SMTP_TRANSPORT').toLowerCase()
  if (raw === 'smtp' || raw === 'direct') return 'smtp'
  if (raw === 'relay' || raw === 'http') return 'relay'
  return 'auto'
}

export function maskEmailForLog(email: string): string {
  const v = email.trim()
  const at = v.indexOf('@')
  if (at <= 0) return '***'
  const local = v.slice(0, at)
  const domain = v.slice(at)
  return `${local.slice(0, 1)}***${domain}`
}

function mailSendError(code: string, message: string): Error & { status: number; code: string } {
  const err = new Error(message) as Error & { status: number; code: string }
  err.status = 502
  err.code = code
  return err
}

/**
 * Read-only SMTP configuration check. Never returns secrets or full FROM if unused.
 */
export function diagnoseSmtpConfig(): SmtpConfigDiagnosis {
  const productionLike = isProductionLikeRuntime()
  const enabled = smtpEnabled()
  const fromOk = fromConfigured()
  const relayOk = relayConfigured()
  const directOk = directSmtpConfigured()
  const host = trimEnv('SMTP_HOST') || null
  const port = parsePort(trimEnv('SMTP_PORT') || (host ? '465' : ''))
  const secure = host ? parseSecure(port) : null
  const userConfigured = Boolean(trimEnv('SMTP_USER'))
  const passwordConfigured = Boolean(trimEnv('SMTP_PASSWORD'))
  const preference = transportPreference()
  const issues: string[] = []

  let mode: SmtpConfigDiagnosis['mode'] = 'unconfigured'

  if (!enabled) {
    issues.push('SMTP_ENABLED is not 1')
  }
  if (!fromOk) {
    issues.push('SMTP_FROM missing')
  }

  if (enabled && fromOk) {
    if (preference === 'smtp') {
      if (!directOk) {
        issues.push('SMTP_TRANSPORT=smtp but direct SMTP credentials incomplete')
        mode = 'unconfigured'
      } else {
        mode = 'smtp'
      }
    } else if (preference === 'relay') {
      if (!relayOk) {
        issues.push('SMTP_TRANSPORT=relay but SMTP_RELAY_URL missing')
        mode = 'unconfigured'
      } else {
        mode = 'smtp_relay'
      }
    } else if (directOk && relayOk) {
      issues.push(
        'Both SMTP_HOST credentials and SMTP_RELAY_URL are set; set SMTP_TRANSPORT=smtp or SMTP_TRANSPORT=relay'
      )
      mode = 'conflict'
    } else if (directOk) {
      mode = 'smtp'
    } else if (relayOk) {
      mode = 'smtp_relay'
    } else {
      issues.push('Neither direct SMTP (HOST/USER/PASSWORD) nor SMTP_RELAY_URL configured')
      mode = 'unconfigured'
    }
  }

  if (mode === 'smtp') {
    if (secure !== true) {
      issues.push('SMTP_SECURE should be true for port 465 (TLS from connect)')
    }
    if (port !== 465 && secure !== true) {
      issues.push('Non-465 SMTP without SMTP_SECURE=true is not recommended')
    }
  }

  const modeReady = mode === 'smtp' || mode === 'smtp_relay'
  const ok = enabled && fromOk && modeReady && issues.length === 0

  return {
    ok,
    mode: enabled && fromOk ? mode : mode === 'conflict' ? 'conflict' : 'unconfigured',
    productionLike,
    smtpEnabled: enabled,
    fromConfigured: fromOk,
    relayConfigured: relayOk,
    directSmtpConfigured: directOk,
    host,
    port,
    secure,
    userConfigured,
    passwordConfigured,
    tlsRejectUnauthorized: true,
    issues,
  }
}

function smtpConfigured(): boolean {
  const d = diagnoseSmtpConfig()
  return d.smtpEnabled && d.fromConfigured && (d.mode === 'smtp' || d.mode === 'smtp_relay')
}

/** Dev/staging: never sends network mail. */
export function createTestMailTransport(): MailTransport {
  return {
    async send(message) {
      console.log('[mail:test]', {
        to: maskEmailForLog(message.to),
        subject: message.subject,
        textLen: message.text.length,
        htmlLen: message.html?.length ?? 0,
      })
      return { ok: true, transport: 'test' }
    },
  }
}

function createRelayMailTransport(from: string, relayUrl: string): MailTransport {
  return {
    async send(message) {
      let res: Response
      try {
        res = await fetch(relayUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(trimEnv('SMTP_RELAY_TOKEN')
              ? { Authorization: `Bearer ${trimEnv('SMTP_RELAY_TOKEN')}` }
              : {}),
          },
          body: JSON.stringify({
            from,
            to: message.to,
            subject: message.subject,
            text: message.text,
            ...(message.html ? { html: message.html } : {}),
          }),
        })
      } catch {
        throw mailSendError('mail_relay_unreachable', 'Mail relay unreachable')
      }
      if (!res.ok) {
        throw mailSendError('mail_relay_failed', `Mail relay failed (${res.status})`)
      }
      return { ok: true, transport: 'smtp_relay' }
    },
  }
}

function createDirectSmtpMailTransport(from: string): MailTransport {
  const host = trimEnv('SMTP_HOST')
  const port = parsePort(trimEnv('SMTP_PORT') || '465')
  const user = trimEnv('SMTP_USER')
  const pass = trimEnv('SMTP_PASSWORD')
  if (!host || !port || !user || !pass) {
    throw new Error('Direct SMTP requires SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD')
  }
  const secure = parseSecure(port)
  const transporter = nodemailerFactory({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: {
      // Mandatory certificate verification — never disable in production paths.
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2',
    },
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 30_000,
  })

  return {
    async send(message) {
      try {
        await transporter.sendMail({
          from,
          to: message.to,
          subject: message.subject,
          text: message.text,
          ...(message.html ? { html: message.html } : {}),
        })
      } catch (e) {
        const raw = e as { code?: string; responseCode?: number; message?: string }
        const code = String(raw.code || '')
        if (code === 'EAUTH' || raw.responseCode === 535) {
          throw mailSendError('mail_smtp_auth', 'SMTP authentication failed')
        }
        if (
          code === 'ESOCKET' ||
          code === 'ECONNECTION' ||
          code === 'ETIMEDOUT' ||
          code === 'EENVELOPE' ||
          code === 'EPROTOCOL'
        ) {
          throw mailSendError('mail_smtp_connect', 'SMTP connection failed')
        }
        throw mailSendError('mail_smtp_send', 'SMTP send failed')
      }
      return { ok: true, transport: 'smtp' }
    },
  }
}

/**
 * Build production/dev mail transport from ENV.
 * Does not require SMTP_RELAY_URL when direct SMTP is configured.
 */
export function createSmtpMailTransport(opts?: { allowTestFallback?: boolean }): MailTransport {
  const from = trimEnv('SMTP_FROM')
  if (!from) {
    throw new Error('SMTP_FROM required when SMTP_ENABLED=1')
  }

  const diagnosis = diagnoseSmtpConfig()
  if (diagnosis.mode === 'conflict') {
    throw new Error(
      'SMTP conflict: both direct SMTP and SMTP_RELAY_URL set; set SMTP_TRANSPORT=smtp or SMTP_TRANSPORT=relay'
    )
  }
  if (diagnosis.mode === 'smtp') {
    return createDirectSmtpMailTransport(from)
  }
  if (diagnosis.mode === 'smtp_relay') {
    return createRelayMailTransport(from, trimEnv('SMTP_RELAY_URL'))
  }

  // Incomplete config
  if (opts?.allowTestFallback === false || isProductionLikeRuntime()) {
    if (relayConfigured() === false && !directSmtpConfigured()) {
      throw new Error(
        'SMTP requires SMTP_RELAY_URL or SMTP_HOST+SMTP_USER+SMTP_PASSWORD in production'
      )
    }
    throw new Error(`SMTP configuration invalid: ${diagnosis.issues.join('; ') || 'unconfigured'}`)
  }
  console.warn('[mail] SMTP_ENABLED=1 but SMTP incomplete — using test transport (non-prod)')
  return createTestMailTransport()
}

let cached: MailTransport | null = null

export function getMailTransport(): MailTransport {
  if (cached) return cached
  if (isProductionLikeRuntime()) {
    if (!smtpConfigured()) {
      throw new Error(
        'SMTP must be configured in production (SMTP_ENABLED, SMTP_FROM, and SMTP_RELAY_URL or SMTP_HOST credentials)'
      )
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

/**
 * Send one message using a fresh transport (no cache). For owner CLI only.
 */
export async function sendOneShotMail(message: MailMessage): Promise<{ ok: true; transport: string }> {
  const transport = createSmtpMailTransport({ allowTestFallback: false })
  return transport.send(message)
}
