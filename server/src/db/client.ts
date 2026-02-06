import dns from 'node:dns'
dns.setDefaultResultOrder('ipv4first')

import pg from 'pg'

const { Pool } = pg

let pool: pg.Pool | null = null

export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set')
    }
    const ssl =
      process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : undefined
    pool = new Pool({ connectionString, ssl })
  }
  return pool
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  return getPool().query<T>(text, params)
}
