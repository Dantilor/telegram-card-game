const fs = require('fs')
let s = fs.readFileSync('src/data/games.ts', 'utf8')
if (!s.includes('playersLabel')) {
  s = s.replace(
    `  catalogBadge?: 'new' | 'hit'\n}`,
    `  catalogBadge?: 'new' | 'hit'\n  /** Real player range from game rules; omit when unknown. */\n  playersLabel?: string\n}`
  )
  const patches = [
    ["id: 'mafia-shadows'", "playersLabel: '4–14 игроков'"],
    ["id: 'doubles'", "playersLabel: '4–12 игроков'"],
    ["id: 'infected'", "playersLabel: '4–12 игроков'"],
    ["id: 'sled'", "playersLabel: '3–8 игроков'"],
    ["id: 'who-is-who'", "playersLabel: '3–8 игроков'"],
    ["id: 'mafia'", "playersLabel: '4–12 игроков'"],
  ]
  for (const [idLine, label] of patches) {
    const re = new RegExp(`(${idLine.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}[\\s\\S]*?status: 'ready',)`)
    if (s.includes(label)) continue
    s = s.replace(re, `$1\n    ${label},`)
  }
  fs.writeFileSync('src/data/games.ts', s)
  console.log('games playersLabel ok')
}
