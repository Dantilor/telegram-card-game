const fs = require('fs')
let s = fs.readFileSync('src/data/games.ts', 'utf8')
if (!s.includes('playersLabel?:')) {
  s = s.replace(
    "catalogBadge?: 'new' | 'hit'\n}",
    "catalogBadge?: 'new' | 'hit'\n  playersLabel?: string\n}"
  )
  if (!s.includes('playersLabel?:')) {
    s = s.replace(
      "catalogBadge?: 'new' | 'hit'\r\n}",
      "catalogBadge?: 'new' | 'hit'\r\n  playersLabel?: string\r\n}"
    )
  }
  fs.writeFileSync('src/data/games.ts', s)
}
console.log('has type', s.includes('playersLabel?:'))
