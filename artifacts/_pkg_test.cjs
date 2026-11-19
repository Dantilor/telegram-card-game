const fs = require('fs')
const p = 'server/package.json'
const j = JSON.parse(fs.readFileSync(p, 'utf8'))
if (!j.scripts.test.includes('sharedPremium.test.ts')) {
  j.scripts.test = j.scripts.test.replace(
    'src/auth/webAuth.test.ts',
    'src/auth/webAuth.test.ts src/auth/sharedPremium.test.ts'
  )
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n')
  console.log('package.json test script updated')
} else {
  console.log('already listed')
}
