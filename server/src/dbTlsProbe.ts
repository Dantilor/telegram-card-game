import tls from 'node:tls'
import { resolvePgPoolConfig } from './dbTls.js'

const resolved = resolvePgPoolConfig(process.env)
if (resolved.summary.host !== '127.0.0.1' && resolved.summary.host !== 'localhost') {
  throw new Error('TLS probe refuses hosts other than loopback')
}

const { pool } = await import('./db.js')
const client = await pool.connect()
try {
  const stream = (client as unknown as { connection?: { stream?: unknown } }).connection?.stream
  if (!(stream instanceof tls.TLSSocket) || stream.authorized !== true) {
    throw new Error('pg pool did not present a verified TLS socket')
  }
  const protocol = stream.getProtocol()
  if (protocol !== 'TLSv1.2' && protocol !== 'TLSv1.3') {
    throw new Error('TLS protocol is below TLSv1.2')
  }
  const row = await client.query<{ ssl: boolean; tls_version: string | null }>(
    `SELECT ssl, version AS tls_version FROM pg_stat_ssl WHERE pid = pg_backend_pid()`
  )
  const session = row.rows[0]
  if (!session?.ssl) throw new Error('PostgreSQL session is not using TLS')
  process.stdout.write(
    `tls_probe: authorized ${protocol} session ${session.tls_version ?? 'unknown'} servername ${resolved.summary.servername}\n`
  )
} finally {
  client.release()
  await pool.end()
}
