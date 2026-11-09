import assert from 'node:assert/strict'
import test from 'node:test'
import {
  adminBroadcastDisabled,
  assertStagingDatabaseUrl,
  isStagingRuntime,
  telegramBotSideEffectsDisabled,
  trustProxyHops,
} from './runtimeFlags.js'

function withEnv(vars: Record<string, string | undefined>, fn: () => void): void {
  const prev: Record<string, string | undefined> = {}
  for (const key of Object.keys(vars)) {
    prev[key] = process.env[key]
    const value = vars[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  try {
    fn()
  } finally {
    for (const key of Object.keys(vars)) {
      const value = prev[key]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

test('staging disables telegram bot side-effects and broadcasts', () => {
  withEnv({ GNH_STAGING: '1', GNH_DISABLE_TELEGRAM_BOT: undefined, GNH_DISABLE_ADMIN_BROADCAST: undefined }, () => {
    assert.equal(isStagingRuntime(), true)
    assert.equal(telegramBotSideEffectsDisabled(), true)
    assert.equal(adminBroadcastDisabled(), true)
  })
})

test('trust proxy defaults on for staging', () => {
  withEnv({ GNH_STAGING: '1', TRUST_PROXY: undefined, NODE_ENV: 'development' }, () => {
    assert.equal(trustProxyHops(), 1)
  })
  withEnv({ GNH_STAGING: undefined, TRUST_PROXY: '0', NODE_ENV: 'development' }, () => {
    assert.equal(trustProxyHops(), false)
  })
})

test('staging DATABASE_URL must be gnh_web_staging and never gnh_supabase', () => {
  withEnv({ GNH_STAGING_DB_NAME: undefined }, () => {
    assert.equal(assertStagingDatabaseUrl('postgres://u:p@h:5432/gnh_web_staging').ok, true)
    assert.equal(assertStagingDatabaseUrl('postgres://u:p@h:5432/gnh_supabase').ok, false)
    assert.equal(assertStagingDatabaseUrl('postgres://u:p@h:5432/other').ok, false)
  })
  withEnv({ GNH_STAGING_DB_NAME: 'custom_staging' }, () => {
    assert.equal(assertStagingDatabaseUrl('postgres://u:p@h:5432/custom_staging').ok, true)
    assert.equal(assertStagingDatabaseUrl('postgres://u:p@h:5432/gnh_web_staging').ok, false)
  })
})
