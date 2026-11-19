const fs = require('fs')
const p = 'C:/Users/User/Desktop/telegram-card-game-2/Import-GnhLegalStaging.ps1'
let t = fs.readFileSync(p, 'utf8')
const nonAscii = /[^\x00-\x7F]/
t = t.replace(/Read-Host -AsSecureString -Prompt '[^']*'/g, "Read-Host -AsSecureString -Prompt 'Password for gnh_web_migrate (hidden)'")
let throwN = 0
t = t.replace(/throw '[^'\n]*'/g, (m) => {
  if (!nonAscii.test(m)) return m
  throwN += 1
  if (throwN === 1) return "throw 'Password not received.'"
  if (throwN === 2) return "throw 'Empty password.'"
  if (throwN === 3) return "throw 'Preflight did not confirm gnh_web_staging / gnh_web_migrate / TLS.'"
  return "throw 'Operation failed.'"
})
t = t.replace(/Write-Host "[^"\n]*"/g, (m) => {
  if (!nonAscii.test(m)) return m
  if (/\$gnhLog/.test(m) && /Error|fail/i.test(m)) return 'Write-Host "Error. Log: $gnhLog"'
  if (/\$gnhLog/.test(m)) return 'Write-Host "Done. Log: $gnhLog"'
  return 'Write-Host "Press Enter to close."'
})
t = t.replace(/Write-Log '[^'\n]*'/g, (m) => {
  if (!nonAscii.test(m) && m.indexOf('\u2014') === -1) return m
  return "Write-Log 'Core docs already active with matching SHA - skip backup/import/activate'"
})
t = t.split('\u2014').join('-')
fs.writeFileSync(p, t, 'utf8')
console.log('fixed', p, 'throws_replaced', throwN, 'len', t.length)