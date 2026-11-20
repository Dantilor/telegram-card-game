#!/usr/bin/env node
/**
 * Owner CLI for SMTP diagnostics and a single explicit test send.
 * Never logs passwords, tokens, or magic-link URLs.
 *
 * Usage:
 *   node scripts/smtp-mail.mjs check
 *   node scripts/smtp-mail.mjs send-test --to you@example.com
 *
 * Requires the same ENV as production (SMTP_*). Does not send on server boot.
 */

import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(__dirname, '..')

async function loadMailModule() {
  const dist = path.join(serverRoot, 'dist', 'services', 'mailTransport.js')
  const src = path.join(serverRoot, 'src', 'services', 'mailTransport.ts')
  try {
    return await import(pathToFileURL(dist).href)
  } catch {
    const require = createRequire(import.meta.url)
    require('tsx/cjs')
    return await import(pathToFileURL(src).href)
  }
}

function parseArgs(argv) {
  const args = { cmd: argv[2] || 'check', to: null }
  for (let i = 3; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--to' && argv[i + 1]) {
      args.to = argv[++i]
    } else if (a.startsWith('--to=')) {
      args.to = a.slice('--to='.length)
    }
  }
  return args
}

function printDiagnosis(d) {
  console.log(
    JSON.stringify(
      {
        ok: d.ok,
        mode: d.mode,
        productionLike: d.productionLike,
        smtpEnabled: d.smtpEnabled,
        fromConfigured: d.fromConfigured,
        relayConfigured: d.relayConfigured,
        directSmtpConfigured: d.directSmtpConfigured,
        host: d.host,
        port: d.port,
        secure: d.secure,
        userConfigured: d.userConfigured,
        passwordConfigured: d.passwordConfigured,
        tlsRejectUnauthorized: d.tlsRejectUnauthorized,
        issues: d.issues,
      },
      null,
      2
    )
  )
}

async function main() {
  const args = parseArgs(process.argv)
  const mail = await loadMailModule()

  if (args.cmd === 'check') {
    const d = mail.diagnoseSmtpConfig()
    printDiagnosis(d)
    process.exit(d.ok ? 0 : 1)
  }

  if (args.cmd === 'send-test') {
    const to = (args.to || '').trim()
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      console.error('Usage: node scripts/smtp-mail.mjs send-test --to owner@example.com')
      process.exit(2)
    }
    const d = mail.diagnoseSmtpConfig()
    if (!d.ok) {
      printDiagnosis(d)
      console.error('SMTP config not ready; refusing send-test')
      process.exit(1)
    }
    const result = await mail.sendOneShotMail({
      to,
      subject: 'GameNight Host — SMTP test',
      text: [
        'GameNight Host',
        '',
        'This is an SMTP test message. Delivery works if you received it.',
        '',
        `Transport: ${d.mode}`,
        `Time: ${new Date().toISOString()}`,
      ].join('\n'),
      html: `<!DOCTYPE html>
<html lang="ru"><body style="font-family:system-ui,sans-serif;background:#f7f3ec;color:#1c1917;padding:24px;">
  <p style="letter-spacing:0.12em;text-transform:uppercase;font-size:12px;color:#78716c;">GameNight Host</p>
  <h1 style="font-size:22px;font-weight:600;">SMTP test</h1>
  <p>Test message from the production mail transport. Delivery succeeded.</p>
  <p style="font-size:13px;color:#57534e;">Transport: ${d.mode}</p>
</body></html>`,
    })
    console.log(
      JSON.stringify(
        {
          ok: true,
          transport: result.transport,
          to: mail.maskEmailForLog(to),
        },
        null,
        2
      )
    )
    process.exit(0)
  }

  console.error('Unknown command. Use: check | send-test --to <email>')
  process.exit(2)
}

main().catch((err) => {
  const code = err && err.code ? String(err.code) : 'mail_error'
  console.error(JSON.stringify({ ok: false, code, message: 'SMTP command failed' }))
  process.exit(1)
})
