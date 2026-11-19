const fs = require('fs')
const p = 'server/src/routes/webAuth.ts'
let s = fs.readFileSync(p, 'utf8')
if (!s.includes('getTelegramPremium,')) {
  s = s.replace(
    'createAnonymousWebAccountSession,\r\n  getWebAccountPremium,',
    'createAnonymousWebAccountSession,\r\n  getTelegramPremium,\r\n  getWebAccountPremium,'
  )
  if (!s.includes('getTelegramPremium,')) {
    s = s.replace(
      'createAnonymousWebAccountSession,\n  getWebAccountPremium,',
      'createAnonymousWebAccountSession,\n  getTelegramPremium,\n  getWebAccountPremium,'
    )
  }
}
fs.writeFileSync(p, s)
console.log('import', s.includes('getTelegramPremium,'))
