const fs = require('fs')

// me.ts
{
  let s = fs.readFileSync('server/src/routes/me.ts', 'utf8')
  s = s.replace(
    "import { getLatestActiveUntil } from '../services/subscriptions.js'\nimport { resolveAuth } from '../auth/resolveAuth.js'\nimport { getWebAccountPremium } from '../auth/webAccounts.js'",
    "import { resolveAuth } from '../auth/resolveAuth.js'\nimport { getTelegramPremium, getWebAccountPremium } from '../auth/webAccounts.js'"
  )
  s = s.replace(
    `    const activeUntilDate = await getLatestActiveUntil(telegramId)
    const now = new Date()
    const premium = activeUntilDate != null && activeUntilDate > now
    const activeUntil = activeUntilDate ? activeUntilDate.toISOString() : null

    res.status(200).json({
      telegramId,
      isPremium: premium,
      premium,
      premiumUntil: activeUntil,
      activeUntil,
      authSource: auth.source,
    })`,
    `    const status = await getTelegramPremium(telegramId)
    res.status(200).json({
      telegramId,
      isPremium: status.isPremium,
      premium: status.isPremium,
      premiumUntil: status.activeUntil,
      activeUntil: status.activeUntil,
      sources: status.sources,
      authSource: auth.source,
    })`
  )
  fs.writeFileSync('server/src/routes/me.ts', s)
  console.log('me.ts ok')
}

// premium.ts
{
  let s = fs.readFileSync('server/src/routes/premium.ts', 'utf8')
  s = s.replace(
    "import { query } from '../db.js'\nimport { resolveAuth } from '../auth/resolveAuth.js'\nimport { getWebAccountPremium } from '../auth/webAccounts.js'",
    "import { resolveAuth } from '../auth/resolveAuth.js'\nimport { getTelegramPremium, getWebAccountPremium } from '../auth/webAccounts.js'"
  )
  // remove QUERY_TIMEOUT if unused - replace telegram branch
  const oldBranch = `    const telegram_id = auth.telegramId
    if (!telegram_id) {
      safeResponse(res, false, null)
      return
    }

    const queryPromise = query<{ active_until: Date }>(
      \`SELECT active_until FROM subscriptions
       WHERE telegram_id = $1
       ORDER BY active_until DESC
       LIMIT 1\`,
      [telegram_id]
    )
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Query timeout')), QUERY_TIMEOUT_MS)
    )
    const rows = await Promise.race([queryPromise, timeoutPromise])

    const sub = rows.rows[0]
    const now = new Date()
    const isPremium = !!sub && new Date(sub.active_until) > now
    const activeUntil = sub ? sub.active_until.toISOString() : null

    safeResponse(res, isPremium, activeUntil, { authSource: auth.source })`

  const newBranch = `    const telegram_id = auth.telegramId
    if (!telegram_id) {
      safeResponse(res, false, null)
      return
    }

    const status = await getTelegramPremium(telegram_id)
    safeResponse(res, status.isPremium, status.activeUntil, {
      authSource: auth.source,
      sources: status.sources,
    })`
  if (!s.includes(oldBranch)) {
    console.error('premium.ts branch missing')
    process.exit(1)
  }
  s = s.replace(oldBranch, newBranch)
  s = s.replace('const QUERY_TIMEOUT_MS = 8000\n', '')
  fs.writeFileSync('server/src/routes/premium.ts', s)
  console.log('premium.ts ok')
}

// premiumCaller - use getTelegramPremium
{
  let s = fs.readFileSync('server/src/auth/premiumCaller.ts', 'utf8')
  s = s.replace(
    "import { getUserPremiumWithDb } from '../premiumStore.js'\nimport { resolveAuth } from './resolveAuth.js'\nimport { getWebAccountPremium } from './webAccounts.js'",
    "import { resolveAuth } from './resolveAuth.js'\nimport { getTelegramPremium, getWebAccountPremium } from './webAccounts.js'"
  )
  s = s.replace(
    `    if (auth.telegramId) {
      const status = await getUserPremiumWithDb(auth.telegramId)
      return status.premium
    }`,
    `    if (auth.telegramId) {
      const status = await getTelegramPremium(auth.telegramId)
      return status.isPremium
    }`
  )
  fs.writeFileSync('server/src/auth/premiumCaller.ts', s)
  console.log('premiumCaller ok')
}

// premiumStore getUserPremiumWithDb - consult shared telegram premium
{
  let s = fs.readFileSync('server/src/premiumStore.ts', 'utf8')
  if (!s.includes('getTelegramPremium')) {
    s = s.replace(
      `export async function getUserPremiumWithDb(telegramId: number): Promise<{
  premium: boolean
  premiumUntil: string | null
  planId: string | null
}> {
  const mem = getUser(telegramId)
  if (mem?.premiumUntil) {
    const premium = mem.premiumUntil > Date.now()
    return {
      premium,
      premiumUntil: new Date(mem.premiumUntil).toISOString(),
      planId: DEFAULT_PLAN_ID,
    }
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
}`,
      `export async function getUserPremiumWithDb(telegramId: number): Promise<{
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
}`
    )
    fs.writeFileSync('server/src/premiumStore.ts', s)
    console.log('premiumStore ok')
  }
}
