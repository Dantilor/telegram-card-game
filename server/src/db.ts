import pg, { Pool } from 'pg'
import { resolvePgPoolConfig } from './dbTls.js'

const connectionString = process.env.DATABASE_URL

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

function redactDbMessage(message: string): string {
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(/(?:password|passwd|pwd)\s*=\s*\S+/gi, 'password=[redacted]')
    .replace(/(?:bearer\s+)\S+/gi, 'Bearer [redacted]')
}

type PgPrivilegeProbeRow = {
  current_user: string
  current_database: string
  inet_server_addr: string | null
  inet_server_port: number | null
  current_schema: string | null
  can_select: boolean
  can_insert: boolean
  can_update: boolean
  session_user: string
  search_path: string
  users_regclass: string | null
  can_usage_public: boolean
}

/**
 * Temporary production probe for Timeweb "permission denied for table users".
 * Logs role/db/schema/privilege facts only — never DATABASE_URL, passwords, or tokens.
 */
export async function logPgPrivilegeDiagnostics(): Promise<void> {
  console.log('[DB] privilege-diag pool', {
    source: 'server/src/db.ts#pool',
    usedBy: [
      '/api/legal/* via legal/runtime withTransaction',
      '/api/legal/offer-acceptances',
      'auth/premium/plans/yookassa/subscriptions',
    ],
  })
  try {
    const res = await pool.query<PgPrivilegeProbeRow>(
      `SELECT
         current_user,
         current_database() AS current_database,
         inet_server_addr()::text AS inet_server_addr,
         inet_server_port() AS inet_server_port,
         current_schema() AS current_schema,
         has_table_privilege(current_user, 'public.users', 'SELECT') AS can_select,
         has_table_privilege(current_user, 'public.users', 'INSERT') AS can_insert,
         has_table_privilege(current_user, 'public.users', 'UPDATE') AS can_update,
         session_user,
         current_setting('search_path') AS search_path,
         to_regclass('public.users')::text AS users_regclass,
         has_schema_privilege(current_user, 'public', 'USAGE') AS can_usage_public`
    )
    const row = res.rows[0]
    console.log('[DB] privilege-diag', {
      current_user: row?.current_user ?? null,
      session_user: row?.session_user ?? null,
      current_database: row?.current_database ?? null,
      inet_server_addr: row?.inet_server_addr ?? null,
      inet_server_port: row?.inet_server_port ?? null,
      current_schema: row?.current_schema ?? null,
      search_path: row?.search_path ?? null,
      users_regclass: row?.users_regclass ?? null,
      can_usage_public: row?.can_usage_public ?? null,
      can_select: row?.can_select ?? null,
      can_insert: row?.can_insert ?? null,
      can_update: row?.can_update ?? null,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'privilege probe failed'
    console.error('[DB] privilege-diag failed', redactDbMessage(message))
  }
}

export async function dbPing(): Promise<void> {
  await logPgPrivilegeDiagnostics()
}
