const fs = require('fs')

// premiumStore
{
  let s = fs.readFileSync('server/src/premiumStore.ts', 'utf8')
  const start = s.indexOf('export async function getUserPremiumWithDb')
  const end = s.indexOf('export { isPremium }')
  if (start < 0 || end < 0) { console.error('premiumStore markers'); process.exit(1) }
  const fn = `export async function getUserPremiumWithDb(telegramId: number): Promise<{
  premium: boolean
  premiumUntil: string | null
  planId: string | null
}> {
  const mem = getUser(telegramId)
  // Hot path: trust in-memory only while still active (Stars grants).
  if (mem?.premiumUntil && mem.premiumUntil > Date.now()) {
    return {
      premium: true,
      premiumUntil: new Date(mem.premiumUntil).toISOString(),
      planId: DEFAULT_PLAN_ID,
    }
  }
  try {
    const { getTelegramPremium } = await import('./auth/webAccounts.js')
    const shared = await getTelegramPremium(telegramId)
    if (shared.isPremium && shared.activeUntil) {
      const untilMs = new Date(shared.activeUntil).getTime()
      if (Number.isFinite(untilMs)) setPremium(telegramId, untilMs)
      return {
        premium: true,
        premiumUntil: shared.activeUntil,
        planId: DEFAULT_PLAN_ID,
      }
    }
  } catch (e) {
    logDbError('[premiumStore] getTelegramPremium failed:', e)
  }
  const db = await getPremiumFromDb(telegramId)
  if (db) {
    setPremium(telegramId, db.premiumUntil)
    const premium = db.premiumUntil > Date.now()
    return {
      premium,
      premiumUntil: new Date(db.premiumUntil).toISOString(),
      planId: db.planId,
    }
  }
  return { premium: false, premiumUntil: null, planId: null }
}

`
  s = s.slice(0, start) + fn + s.slice(end)
  fs.writeFileSync('server/src/premiumStore.ts', s)
  console.log('premiumStore ok')
}

// webAuth.ts: import getTelegramPremium and enrich complete responses
{
  let s = fs.readFileSync('server/src/routes/webAuth.ts', 'utf8')
  s = s.replace(
    `  getWebAccountPremium,
  grantWebEntitlement,
  revokeTelegramLinkEntitlements,
} from '../auth/webAccounts.js'`,
    `  getTelegramPremium,
  getWebAccountPremium,
  grantWebEntitlement,
  revokeTelegramLinkEntitlements,
} from '../auth/webAccounts.js'`
  )

  // After real complete transaction, enrich response with shared premium (WEB purchase visible to TG without copying into subscriptions)
  const completeReturn = `    res.status(200).json({
      ok: true,
      linked: true,
      telegramId: auth.telegramId,
      premiumRestored: result.premiumRestored,
      activeUntil: result.activeUntil,
    })`
  const completeReturnNew = `    const webPremium = await getWebAccountPremium(result.webAccountId)
    const tgPremium = await getTelegramPremium(auth.telegramId)
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
      telegramId: auth.telegramId,
      premiumRestored: result.premiumRestored || webPremium.sources.includes('web_purchase'),
      isPremium: Boolean(activeUntil && new Date(activeUntil) > new Date()),
      activeUntil,
      sources,
      webPremium,
      telegramPremium: tgPremium,
    })`

  // Need result.webAccountId from transaction - update return of tx
  if (!s.includes('webAccountId: row.web_account_id')) {
    s = s.replace(
      `      return {
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
    })`,
      `      return {
        webAccountId: row.web_account_id,
        premiumRestored: Boolean(sub.rows[0]),
        activeUntil: sub.rows[0]?.active_until
          ? new Date(sub.rows[0].active_until).toISOString()
          : null,
      }
    })

    const webPremium = await getWebAccountPremium(result.webAccountId)
    const tgPremium = await getTelegramPremium(auth.telegramId!)
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
      telegramId: auth.telegramId,
      premiumRestored: result.premiumRestored || webPremium.sources.includes('web_purchase'),
      isPremium: Boolean(activeUntil && new Date(activeUntil) > new Date()),
      activeUntil,
      sources,
      webPremium,
      telegramPremium: tgPremium,
    })`
    )
  }

  // complete-mock enrichment
  if (!s.includes('telegramPremium: tgPremium')) {
    // already handled above for complete; do mock separately
  }
  if (!s.includes('complete-mock shared premium')) {
    s = s.replace(
      `    res.status(200).json({
      ok: true,
      linked: true,
      telegramId,
      premiumRestored: Boolean(sub.rows[0]),
      activeUntil: sub.rows[0]?.active_until
        ? new Date(sub.rows[0].active_until).toISOString()
        : null,
    })
  } catch (e) {
    const { status, body } = errorPayload(e)
    res.status(status).json(body)
  }
})

/**
 * Optional: bind email to current WEB account (purchase protection).`,
      `    // complete-mock shared premium (no copy of web_purchase into subscriptions)
    const webPremium = await getWebAccountPremium(row.web_account_id)
    const tgPremium = await getTelegramPremium(telegramId)
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
      telegramId,
      premiumRestored: Boolean(sub.rows[0]) || webPremium.sources.includes('web_purchase'),
      isPremium: Boolean(activeUntil && new Date(activeUntil) > new Date()),
      activeUntil,
      sources,
      webPremium,
      telegramPremium: tgPremium,
    })
  } catch (e) {
    const { status, body } = errorPayload(e)
    res.status(status).json(body)
  }
})

/**
 * Optional: bind email to current WEB account (purchase protection).`
    )
  }

  fs.writeFileSync('server/src/routes/webAuth.ts', s)
  console.log('webAuth ok', s.includes('getTelegramPremium'), s.includes('webPremium'))
}
