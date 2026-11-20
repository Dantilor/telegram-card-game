import fs from 'node:fs'
import path from 'node:path'
import pg from '../server/node_modules/pg/lib/index.js'

/**
 * Re-apply synthetic seed users before Playwright so local mock payments
 * cannot leave 900001 free with Premium or 900004 expired still active.
 * Local-only; refuses non-gnh_web_local databases.
 */
export default async function globalSetup() {
  const root = process.cwd()
  const envPath = path.join(root, 'server', '.env.web-local')
  if (!fs.existsSync(envPath)) return

  const envText = fs.readFileSync(envPath, 'utf8')
  const match = envText.match(/^DATABASE_URL=(.+)$/m)
  const connectionString = (match?.[1] || '').trim()
  if (!connectionString) return

  const client = new pg.Client({ connectionString })
  await client.connect()
  try {
    const db = await client.query<{ current_database: string }>('SELECT current_database()')
    if (db.rows[0]?.current_database !== 'gnh_web_local') {
      throw new Error(`refusing Playwright seed on database ${db.rows[0]?.current_database}`)
    }
    const sql = fs.readFileSync(path.join(root, 'deploy/local/seed_e2e.sql'), 'utf8')
    await client.query(sql)
  } finally {
    await client.end()
  }
}
