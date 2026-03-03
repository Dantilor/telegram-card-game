import pg, { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL

if (connectionString) {
  try {
    const url = new URL(connectionString)
    const host = url.hostname
    const port = url.port || '5432'
    const database = url.pathname.replace(/^\//, '') || '(default)'
    const user = url.username ? decodeURIComponent(url.username) : '(none)'
    console.log('[DB] config', { host, port, database, user })
  } catch (e) {
    console.warn('[DB] could not parse DATABASE_URL for log:', e instanceof Error ? e.message : String(e))
  }
} else {
  console.warn('[DB] DATABASE_URL is not set')
}

export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
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
