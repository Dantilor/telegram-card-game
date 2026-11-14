#!/usr/bin/env node
/**
 * Load server/.env.web-local (gitignored) then spawn a child command.
 * Refuses if DATABASE_URL targets gnh_supabase or Timeweb.
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(__dirname, '..')
const envPath = path.join(serverRoot, '.env.web-local')

if (!fs.existsSync(envPath)) {
  console.error('Missing server/.env.web-local — run deploy/local/Setup-GnhWebLocal.ps1 first')
  process.exit(1)
}

dotenv.config({ path: envPath, override: true })

const url = (process.env.DATABASE_URL || '').trim()
if (!url || /gnh_supabase/i.test(url) || /\.twc1\.net/i.test(url) || /gnh_web_staging/i.test(url)) {
  console.error('Refusing unsafe DATABASE_URL in .env.web-local')
  process.exit(1)
}
process.env.GNH_LOCAL_DATABASE = '1'
process.env.NODE_ENV = process.env.NODE_ENV || 'development'

const args = process.argv.slice(2)
if (!args.length) {
  console.error('Usage: node scripts/run-with-web-local-env.mjs <command> [args...]')
  process.exit(1)
}

const child = spawn(args[0], args.slice(1), {
  cwd: serverRoot,
  env: process.env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
child.on('exit', (code) => process.exit(code ?? 1))
