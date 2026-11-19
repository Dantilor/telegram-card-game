const fs = require('fs')
const p = 'src/lib/webAuth.ts'
let s = fs.readFileSync(p, 'utf8')
if (s.includes('unlinkTelegramLink')) { console.log('client exists'); process.exit(0) }
const needle = 'export async function startEmailBind'
const idx = s.indexOf(needle)
if (idx < 0) { console.error('missing'); process.exit(1) }
const fn = `export async function unlinkTelegramLink(): Promise<{
  ok: boolean
  linked: boolean
  revoked: boolean
  isPremium?: boolean
  activeUntil?: string | null
  sources?: string[]
}> {
  const csrf = readCsrfToken()
  const res = await fetch(\`\${apiBase()}/api/web/telegram-link/unlink\`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
    },
  })
  if (!res.ok) {
    const err = new Error('telegram_link_unlink_failed') as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return (await res.json()) as {
    ok: boolean
    linked: boolean
    revoked: boolean
    isPremium?: boolean
    activeUntil?: string | null
    sources?: string[]
  }
}

`
s = s.slice(0, idx) + fn + s.slice(idx)
fs.writeFileSync(p, s)
console.log('client ok')
