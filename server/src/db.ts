import pg, { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL
const ssl = { rejectUnauthorized: false as const }

if (connectionString) {
  try {
    const url = new URL(connectionString)
    const host = url.hostname
    const port = url.port || '5432'
    const database = url.pathname.replace(/^\//, '') || '(default)'
    const user = url.username ? decodeURIComponent(url.username) : '(none)'
    const sslmode = url.searchParams.get('sslmode') || null
    console.log('[DB] config', { host, port, database, user, sslmode })
  } catch (e) {
    console.warn(
      '[DB] could not parse DATABASE_URL for log:',
      e instanceof Error ? e.message : String(e)
    )
  }
} else {
  console.warn('[DB] DATABASE_URL is not set')
}

console.log('[DB] ssl rejectUnauthorized', ssl.rejectUnauthorized)

export const pool = new Pool({
  connectionString,
  ssl,

  // Ограничиваем количество соединений для Supabase pooler
  max: 3,

  // Таймауты
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,

  // держит соединение живым
  keepAlive: true,
})

pool.on('connect', () => {
  console.log('[DB] connected')
})

pool.on('error', (err) => {
  console.error('[DB] unexpected error', err)
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
    console.error('[DB] ping failed', e)
  }
}
