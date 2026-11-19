import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const meta = JSON.parse(fs.readFileSync(path.join(__dirname, '../.local-pg/connection.json'), 'utf8'))
const sql = fs.readFileSync(path.join(__dirname, '../../deploy/local/seed_e2e.sql'), 'utf8')
const client = new pg.Client({ connectionString: meta.connectionString, ssl: false })
await client.connect()
await client.query(sql)
const r = await client.query(
  `SELECT version FROM legal_document_activations WHERE document_id = 'offer' AND deactivated_at IS NULL`
)
console.log('active offer versions:', r.rows)
await client.end()
