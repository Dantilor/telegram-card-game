const fs = require('fs')
const p = 'src/pages/Profile.tsx'
let s = fs.readFileSync(p, 'utf8')
const from = "from '../lib/webAuth'"
const idx = s.indexOf(from)
if (idx < 0) throw new Error('from missing')
const start = s.lastIndexOf('import {', idx)
const block = s.slice(start, idx + from.length)
console.log(JSON.stringify(block))
if (!block.includes('unlinkTelegramLink')) {
  const newBlock = block.replace('startTelegramLinkRestore,', 'startTelegramLinkRestore,\n  unlinkTelegramLink,')
  s = s.slice(0, start) + newBlock + s.slice(idx + from.length)
}
// setTgLinked(true) on poll
if (!s.includes('setTgLinked(true)')) {
  s = s.replace('if (status.linked) {\n          stopTgPoll()\n          await refreshPremium()', 'if (status.linked) {\n          stopTgPoll()\n          setTgLinked(true)\n          await refreshPremium()')
  s = s.replace('if (status.linked) {\r\n          stopTgPoll()\r\n          await refreshPremium()', 'if (status.linked) {\r\n          stopTgPoll()\r\n          setTgLinked(true)\r\n          await refreshPremium()')
}
// mount status fetch
if (!s.includes('setTgLinked(Boolean(status.linked))')) {
  const anchor = 'useEffect(() => {\n    return () => {\n      if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current)'
  const anchorCr = anchor.replace(/\n/g, '\r\n')
  const mount = `useEffect(() => {
    if (!web) return
    let cancelled = false
    void fetchTelegramLinkStatus()
      .then((status) => {
        if (!cancelled) setTgLinked(Boolean(status.linked))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [web])

  `
  if (s.includes(anchor)) s = s.replace(anchor, mount + anchor)
  else if (s.includes(anchorCr)) s = s.replace(anchorCr, mount.replace(/\n/g, '\r\n') + anchorCr)
  else console.log('mount anchor missing')
}
fs.writeFileSync(p, s)
console.log('ok', s.includes('unlinkTelegramLink,'), s.includes('setTgLinked(true)'), s.includes('setTgLinked(Boolean'))
