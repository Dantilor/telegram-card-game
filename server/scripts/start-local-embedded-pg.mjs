#!/usr/bin/env node
/**
 * Start an embedded PostgreSQL cluster for local WEB E2E (no Docker, no Timeweb).
 * Writes connection metadata to server/.local-pg/connection.json (gitignored).
 *
 * Usage:
 *   node scripts/start-local-embedded-pg.mjs
 *   node scripts/start-local-embedded-pg.mjs --stop
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(__dirname, '..')
const dataDir = path.join(serverRoot, '.local-pg')
const metaPath = path.join(dataDir, 'connection.json')
const stopOnly = process.argv.includes('--stop')

const PORT = Number(process.env.GNH_LOCAL_PG_PORT || 55432)
const USER = 'gnh_local'
const PASSWORD = 'gnh_local_dev'
const DB = 'gnh_web_local'

function die(msg) {
  console.error(msg)
  process.exit(1)
}

async function loadEmbedded() {
  try {
    const mod = await import('embedded-postgres')
    return mod.default
  } catch (e) {
    die(
      `embedded-postgres is required for local E2E without system Postgres password. Install: npm i -D embedded-postgres (${e instanceof Error ? e.message : e})`
    )
  }
}

async function stopExisting(EmbeddedPostgres) {
  if (!fs.existsSync(metaPath)) {
    console.log('No local embedded cluster metadata; nothing to stop.')
    return
  }
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
  const pg = new EmbeddedPostgres({
    databaseDir: meta.databaseDir || path.join(dataDir, 'cluster'),
    user: meta.user || USER,
    password: meta.password || PASSWORD,
    port: meta.port || PORT,
    persistent: true,
    autoRehydrateSymlinks: true,
  })
  try {
    await pg.stop()
    console.log('Stopped embedded Postgres on port', meta.port || PORT)
  } catch (e) {
    console.warn('Stop warning:', e instanceof Error ? e.message : e)
  }
}

async function main() {
  const EmbeddedPostgres = await loadEmbedded()
  fs.mkdirSync(dataDir, { recursive: true })

  if (stopOnly) {
    await stopExisting(EmbeddedPostgres)
    return
  }

  const clusterDir = path.join(dataDir, 'cluster')
  const pg = new EmbeddedPostgres({
    databaseDir: clusterDir,
    user: USER,
    password: PASSWORD,
    port: PORT,
    persistent: true,
    autoRehydrateSymlinks: true,
  })

  if (!fs.existsSync(path.join(clusterDir, 'PG_VERSION'))) {
    console.log('Initialising embedded Postgres cluster…')
    await pg.initialise()
  }

  console.log('Starting embedded Postgres on', PORT)
  await pg.start()

  try {
    await pg.createDatabase(DB)
    console.log('Created database', DB)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!/already exists/i.test(msg)) {
      console.warn('createDatabase:', msg)
    } else {
      console.log('Database already exists:', DB)
    }
  }

  const connectionString = `postgresql://${encodeURIComponent(USER)}:${encodeURIComponent(PASSWORD)}@127.0.0.1:${PORT}/${DB}`
  const meta = {
    host: '127.0.0.1',
    port: PORT,
    user: USER,
    database: DB,
    databaseDir: clusterDir,
    connectionString,
    startedAt: new Date().toISOString(),
  }
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf8')
  console.log('Wrote', path.relative(serverRoot, metaPath))
  console.log('LOCAL_DATABASE_URL set for migrate (password not printed).')
  console.log('Keep this process running, or leave the cluster started and stop later with --stop.')

  // Keep process alive so cluster stays up when launched as a foreground service.
  if (process.argv.includes('--keep-alive')) {
    process.on('SIGINT', async () => {
      await pg.stop().catch(() => {})
      process.exit(0)
    })
    await new Promise(() => {})
  } else {
    // Detach: embedded-postgres keeps running as child until --stop.
    console.log('Cluster started (persistent). Use --stop to shut down.')
  }
}

await main()
