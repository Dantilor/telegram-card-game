const fs = require('fs')
let s = fs.readFileSync('server/src/routes/webAuth.ts', 'utf8')

if (!s.includes('getTelegramPremium,')) {
  s = s.replace(
    '  getWebAccountPremium,\n  grantWebEntitlement,',
    '  getTelegramPremium,\n  getWebAccountPremium,\n  grantWebEntitlement,'
  )
}

function enrichBlock(telegramExpr, webAccountExpr, premiumRestoredExpr) {
  return `    const webPremium = await getWebAccountPremium(${webAccountExpr})
    const tgPremium = await getTelegramPremium(${telegramExpr})
    const activeUntil =
      webPremium.activeUntil && tgPremium.activeUntil
        ? new Date(webPremium.activeUntil) > new Date(tgPremium.activeUntil)
          ? webPremium.activeUntil
          : tgPremium.activeUntil
        : webPremium.activeUntil || tgPremium.activeUntil
    const sources = [...new Set([...webPremium.sources, ...tgPremium.sources])]
    res.status(200).json({
      ok: true,
      linked: true,
      telegramId: ${telegramExpr},
      premiumRestored: ${premiumRestoredExpr},
      isPremium: Boolean(activeUntil && new Date(activeUntil) > new Date()),
      activeUntil,
      sources,
      webPremium,
      telegramPremium: tgPremium,
    })`
}

// complete real
{
  const needle = `      return {
        premiumRestored: Boolean(sub.rows[0]),
        activeUntil: sub.rows[0]?.active_until
          ? new Date(sub.rows[0].active_until).toISOString()
          : null,
      }
    })

    res.status(200).json({
      ok: true,
      linked: true,
      telegramId: auth.telegramId,
      premiumRestored: result.premiumRestored,
      activeUntil: result.activeUntil,
    })`
  const needleN = needle.replace(/\n/g, '\r\n')
  const repl = `      return {
        webAccountId: row.web_account_id,
        premiumRestored: Boolean(sub.rows[0]),
        activeUntil: sub.rows[0]?.active_until
          ? new Date(sub.rows[0].active_until).toISOString()
          : null,
      }
    })

${enrichBlock('auth.telegramId!', 'result.webAccountId', "result.premiumRestored || webPremium.sources.includes('web_purchase')")}`
  if (s.includes(needle)) s = s.replace(needle, repl)
  else if (s.includes(needleN)) s = s.replace(needleN, repl.replace(/\n/g, '\r\n'))
  else console.log('complete block not found')
}

// complete-mock
{
  const needle = `    res.status(200).json({
      ok: true,
      linked: true,
      telegramId,
      premiumRestored: Boolean(sub.rows[0]),
      activeUntil: sub.rows[0]?.active_until
        ? new Date(sub.rows[0].active_until).toISOString()
        : null,
    })`
  const needleN = needle.replace(/\n/g, '\r\n')
  const repl = enrichBlock('telegramId', 'row.web_account_id', "Boolean(sub.rows[0]) || webPremium.sources.includes('web_purchase')")
  if (s.includes(needle)) s = s.replace(needle, repl)
  else if (s.includes(needleN)) s = s.replace(needleN, repl.replace(/\n/g, '\r\n'))
  else console.log('mock block not found')
}

fs.writeFileSync('server/src/routes/webAuth.ts', s)
console.log({
  import: s.includes('getTelegramPremium,'),
  webPremium: (s.match(/webPremium/g) || []).length,
  telegramPremium: (s.match(/telegramPremium/g) || []).length,
})
