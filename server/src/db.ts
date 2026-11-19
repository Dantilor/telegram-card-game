import pg, { Pool } from 'pg'
import { resolvePgPoolConfig } from './dbTls.js'

const connectionString = process.env.DATABASE_URL

/**
 * Loopback-only plaintext Postgres for local WEB E2E (gnh_web_local).
 * Never allowed for production, staging, Timeweb, or non-local DB names.
 */
export function allowLocalPlaintextDatabase(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.GNH_LOCAL_DATABASE !== '1' && env.GNH_LOCAL_DATABASE !== 'true') return false
  if (env.NODE_ENV === 'production') return false
  if (env.GNH_PRODUCTION === '1' || env.GNH_PRODUCTION === 'true') return false
  if (env.GNH_STAGING === '1' || env.GNH_STAGING === 'true') return false
  if (env.TIMEWEB === '1' || env.TIMEWEB === 'true') return false
  if (env.RENDER === 'true' || Boolean(env.RENDER_EXTERNAL_URL)) return false
  const raw = (env.DATABASE_URL || '').trim()
  if (!raw) return false
  try {
    const u = new URL(raw)
    const host = u.hostname
    const database = decodeURIComponent(u.pathname.replace(/^\//, ''))
    if (host !== '127.0.0.1' && host !== 'localhost' && host !== '::1') return false
    if (database !== 'gnh_web_local') return false
    if (/\.twc1\.net$/i.test(host) || /gnh_supabase/i.test(database)) return false
    return true
  } catch {
    return false
  }
}

function poolConfig(): pg.PoolConfig {
  const limits = {
    max: 3,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    keepAlive: true,
  }
  if (!connectionString) {
    console.warn('[DB] DATABASE_URL is not set')
    console.log('[DB] ssl', { rejectUnauthorized: true, minVersion: 'TLSv1.2', caSource: 'system' })
    return {
      ...limits,
      ssl: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
    }
  }
  if (allowLocalPlaintextDatabase(process.env)) {
    const parsed = new URL(connectionString)
    console.log('[DB] config', {
      host: parsed.hostname,
      port: parsed.port || '5432',
      database: decodeURIComponent(parsed.pathname.replace(/^\//, '')),
      user: decodeURIComponent(parsed.username),
      localPlaintext: true,
      rejectUnauthorized: false,
    })
    return {
      ...limits,
      connectionString,
      ssl: false,
    }
  }
  const resolved = resolvePgPoolConfig(process.env)
  console.log('[DB] config', {
    host: resolved.summary.host,
    port: resolved.summary.port,
    database: resolved.summary.database,
    user: resolved.summary.user,
    rejectUnauthorized: resolved.summary.rejectUnauthorized,
    minVersion: resolved.summary.minVersion,
    servername: resolved.summary.servername,
    caSource: resolved.summary.caSource,
    checkServerIdentity: resolved.summary.checkServerIdentity,
  })
  return {
    ...limits,
    connectionString: resolved.connectionString,
    ssl: resolved.ssl,
  }
}

export const pool = new Pool(poolConfig())

pool.on('connect', () => {
  console.log('[DB] connected')
})

pool.on('error', (err) => {
  const message = err instanceof Error ? err.message : 'unexpected database error'
  console.error('[DB] unexpected error', message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]'))
})

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params)
}

export async function dbPing(): Promise<void> {
  try {
    const res = await pool.query<{ current_user: string; current_database: string }>(
      'SELECT current_user, current_database() AS current_database'
    )
    const row = res.rows[0]
    console.log('[DB] ping', {
      current_user: row?.current_user,
      current_database: row?.current_database,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'ping failed'
    console.error('[DB] ping failed', message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]'))
  }
}
