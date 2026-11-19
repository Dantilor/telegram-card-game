const fs = require('fs')
const p = 'src/pages/Profile.tsx'
let s = fs.readFileSync(p, 'utf8')

s = s.replace(
  `import {
  fetchTelegramLinkStatus,
  startEmailBind,
  startTelegramLinkRestore,
  verifyEmailBind,
} from '../lib/webAuth'`,
  `import {
  fetchTelegramLinkStatus,
  startEmailBind,
  startTelegramLinkRestore,
  unlinkTelegramLink,
  verifyEmailBind,
} from '../lib/webAuth'`
)

if (!s.includes('const [tgLinked, setTgLinked]')) {
  s = s.replace(
    'const [tgCopyDone, setTgCopyDone] = useState(false)',
    `const [tgCopyDone, setTgCopyDone] = useState(false)
  const [tgLinked, setTgLinked] = useState(false)`
  )
}

if (!s.includes('handleUnlinkTelegram')) {
  s = s.replace(
    'const handleCopyTgCode = useCallback(async () => {',
    `const handleUnlinkTelegram = useCallback(async () => {
    if (!web) return
    haptic('medium')
    setRestoreLoading(true)
    try {
      const result = await unlinkTelegramLink()
      setTgLinked(false)
      setTgRestore(null)
      await refreshPremium()
      setRestoreStatus(
        result.revoked
          ? 'Привязка Telegram отключена. WEB-покупки сохранены.'
          : 'Активной привязки не найдено'
      )
    } catch {
      setRestoreStatus('Не удалось отвязать Telegram')
    } finally {
      setRestoreLoading(false)
      if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current)
      restoreTimerRef.current = setTimeout(() => {
        setRestoreStatus(null)
        restoreTimerRef.current = null
      }, 2500)
    }
  }, [web, refreshPremium])

  const handleCopyTgCode = useCallback(async () => {`
  )
}

if (!s.includes('fetchTelegramLinkStatus().then((status)')) {
  s = s.replace(
    `useEffect(() => {
    return () => {
      if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current)
      stopTgPoll()
    }
  }, [stopTgPoll])`,
    `useEffect(() => {
    if (!web) return
    let cancelled = false
    void fetchTelegramLinkStatus()
      .then((status) => {
        if (!cancelled) setTgLinked(Boolean(status.linked))
      })
      .catch(() => {
        /* ignore */
      })
    return () => {
      cancelled = true
    }
  }, [web])

  useEffect(() => {
    return () => {
      if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current)
      stopTgPoll()
    }
  }, [stopTgPoll])`
  )
}

// When linked via poll, set tgLinked
s = s.replace(
  'if (status.linked) {\n          stopTgPoll()\n          await refreshPremium()',
  'if (status.linked) {\n          stopTgPoll()\n          setTgLinked(true)\n          await refreshPremium()'
)

// Add unlink button in linked phase panel
if (!s.includes('Отвязать Telegram')) {
  s = s.replace(
    `{tgRestore.phase === 'linked' ? (
          <>
            <p className="profile-pass__desc profile-pass__desc--ok">
              {tgRestore.message || 'Привязка выполнена.'}
            </p>
            <p className="profile-pass__active-date">
              {formatPremiumUntilLabel(tgRestore.activeUntil ?? activeUntil)}
            </p>
          </>
        ) : null}`,
    `{tgRestore.phase === 'linked' ? (
          <>
            <p className="profile-pass__desc profile-pass__desc--ok">
              {tgRestore.message || 'Привязка выполнена.'}
            </p>
            <p className="profile-pass__active-date">
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
        ) : null}`
  )
}

// Show unlink when already linked even without restore panel
if (!s.includes('{web && tgLinked && !tgRestore && (')) {
  s = s.replace(
    '{tgRestorePanel}\n              {!web && (',
    `{tgRestorePanel}
              {web && tgLinked && !tgRestore && (
                <button
                  type="button"
                  className="profile-pass__restore"
                  onClick={() => void handleUnlinkTelegram()}
                  disabled={restoreLoading}
                >
                  Отвязать Telegram
                </button>
              )}
              {!web && (`,
    true // won't work - replace_all
  )
}

// replace_all true via split - do manually both occurrences
const needle = '{tgRestorePanel}\r\n              {!web && ('
const needle2 = '{tgRestorePanel}\n              {!web && ('
const insert = `{tgRestorePanel}
              {web && tgLinked && !tgRestore && (
                <button
                  type="button"
                  className="profile-pass__restore"
                  onClick={() => void handleUnlinkTelegram()}
                  disabled={restoreLoading}
                >
                  Отвязать Telegram
                </button>
              )}
              {!web && (`
if (s.includes(needle2) && !s.includes('tgLinked && !tgRestore')) {
  s = s.split(needle2).join(insert)
}

fs.writeFileSync(p, s)
console.log('profile patched', s.includes('unlinkTelegramLink'), s.includes('Отвязать Telegram'), (s.match(/Отвязать Telegram/g)||[]).length)
