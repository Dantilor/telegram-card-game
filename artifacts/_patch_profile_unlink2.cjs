const fs = require('fs')
const p = 'src/pages/Profile.tsx'
let s = fs.readFileSync(p, 'utf8')

if (!s.includes('unlinkTelegramLink,')) {
  s = s.replace('startTelegramLinkRestore,\n  verifyEmailBind,', 'startTelegramLinkRestore,\n  unlinkTelegramLink,\n  verifyEmailBind,')
}

// linked panel button
const linkedNeedle = `            <p className="profile-pass__active-date">
              {formatPremiumUntilLabel(tgRestore.activeUntil ?? activeUntil)}
            </p>
          </>
        ) : null}
        {tgRestore.phase === 'expired' || tgRestore.phase === 'error' ? (`

const linkedInsert = `            <p className="profile-pass__active-date">
              {formatPremiumUntilLabel(tgRestore.activeUntil ?? activeUntil)}
            </p>
            <button
              type="button"
              className="profile-pass__restore"
              onClick={() => void handleUnlinkTelegram()}
              disabled={restoreLoading}
            >
              Отвязать Telegram
            </button>
          </>
        ) : null}
        {tgRestore.phase === 'expired' || tgRestore.phase === 'error' ? (`

if (!s.includes('Отвязать Telegram') && s.includes(linkedNeedle)) {
  s = s.replace(linkedNeedle, linkedInsert)
  console.log('linked button inserted')
} else {
  console.log('linked button skip', s.includes('Отвязать Telegram'), s.includes(linkedNeedle))
}

// both premium active/inactive areas after tgRestorePanel
let count = 0
const panelNeedle = '{tgRestorePanel}'
const idx1 = s.indexOf(panelNeedle)
const idx2 = s.indexOf(panelNeedle, idx1 + 1)
function insertAfterPanel(at) {
  const after = s.indexOf('\n', at + panelNeedle.length)
  const chunk = s.slice(at, after + 1)
  // find following {!web && (
  const look = s.slice(after + 1, after + 80)
  if (look.includes('tgLinked && !tgRestore')) return
  const btn = `{tgRestorePanel}
              {web && tgLinked && !tgRestore && (
                <button
                  type="button"
                  className="profile-pass__restore"
                  onClick={() => void handleUnlinkTelegram()}
                  disabled={restoreLoading}
                >
                  Отвязать Telegram
                </button>
              )}`
  // replace only this occurrence of {tgRestorePanel} at position
  s = s.slice(0, at) + btn + s.slice(at + panelNeedle.length)
  count++
}
if (idx1 >= 0) insertAfterPanel(idx1)
// recompute second after first insert grew length
const next = s.indexOf(panelNeedle, idx1 + 20)
if (next >= 0) {
  // only replace bare {tgRestorePanel} not already expanded - check nearby
  const near = s.slice(next, next + 120)
  if (!near.includes('tgLinked')) {
    // find second bare occurrence more carefully
    let searchFrom = 0
    let found = 0
    while (true) {
      const i = s.indexOf('{tgRestorePanel}', searchFrom)
      if (i < 0) break
      const near2 = s.slice(i, i + 100)
      if (!near2.includes('tgLinked')) {
        const btn = `{tgRestorePanel}
              {web && tgLinked && !tgRestore && (
                <button
                  type="button"
                  className="profile-pass__restore"
                  onClick={() => void handleUnlinkTelegram()}
                  disabled={restoreLoading}
                >
                  Отвязать Telegram
                </button>
              )}`
        s = s.slice(0, i) + btn + s.slice(i + '{tgRestorePanel}'.length)
        found++
        searchFrom = i + btn.length
      } else {
        searchFrom = i + 20
      }
      if (found >= 2) break
    }
    count = found
  }
}

fs.writeFileSync(p, s)
console.log('done', (s.match(/Отвязать Telegram/g)||[]).length, s.includes('unlinkTelegramLink,'))
