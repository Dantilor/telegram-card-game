const fs = require('fs')
const p = 'src/pages/Profile.tsx'
let s = fs.readFileSync(p, 'utf8')
if (!s.includes('unlinkTelegramLink,')) {
  s = s.replace(
    '  startTelegramLinkRestore,\n  verifyEmailBind,',
    '  startTelegramLinkRestore,\n  unlinkTelegramLink,\n  verifyEmailBind,'
  )
}
// linked phase button if still missing inside panel
if ((s.match(/Отвязать Telegram/g) || []).length < 3) {
  const marker = `{formatPremiumUntilLabel(tgRestore.activeUntil ?? activeUntil)}
            </p>
          </>
        ) : null}`
  if (s.includes(marker) && !s.includes(`{formatPremiumUntilLabel(tgRestore.activeUntil ?? activeUntil)}
            </p>
            <button
              type="button"
              className="profile-pass__restore"
              onClick={() => void handleUnlinkTelegram()}`)) {
    s = s.replace(
      marker,
      `{formatPremiumUntilLabel(tgRestore.activeUntil ?? activeUntil)}
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
        ) : null}`
    )
  }
}
fs.writeFileSync(p, s)
console.log('import', s.includes('unlinkTelegramLink,'), 'count', (s.match(/Отвязать Telegram/g)||[]).length)
