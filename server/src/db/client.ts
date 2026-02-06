import dns from 'node:dns'
import pg from 'pg'

const { Pool } = pg

let pool: pg.Pool | null = null

function getPool(): pg.Pool {
  if (pool) return pool
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL not configured')

  pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    // Force IPv4: pg passes lookup to net.connect, so IPv6 won't be used
    lookup: (hostname: string, _opts: unknown, cb: (err: NodeJS.ErrnoException | null, address: string, family: number) => void) => {
      dns.lookup(hostname, { family: 4 }, cb)
    },
  } as pg.PoolConfig)

  return pool
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  const p = getPool()
  return p.query<T>(text, params)
}
