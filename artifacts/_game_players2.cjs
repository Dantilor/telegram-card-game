const fs = require('fs')
let s = fs.readFileSync('src/data/games.ts', 'utf8')
function addLabel(id, label) {
  if (s.includes(`id: '${id}'`) && s.includes(label) && s.indexOf(label) > s.indexOf(`id: '${id}'`) && s.indexOf(label) < s.indexOf(`id: '${id}'`) + 400) return
  const needle = `id: '${id}',`
  const i = s.indexOf(needle)
  if (i < 0) return
  const status = s.indexOf("status: 'ready',", i)
  if (status < 0) return
  const insertAt = status + "status: 'ready',".length
  if (s.slice(i, i + 350).includes('playersLabel')) return
  s = s.slice(0, insertAt) + `\n    playersLabel: '${label}',` + s.slice(insertAt)
}
addLabel('infected', '4–12 игроков')
addLabel('who-is-who', '3–8 игроков')
addLabel('mafia', '4–12 игроков')
fs.writeFileSync('src/data/games.ts', s)
console.log((s.match(/playersLabel/g)||[]).length)
