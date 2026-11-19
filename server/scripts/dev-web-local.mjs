#!/usr/bin/env node
/**
 * Start local WEB API with server/.env.web-local loaded.
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

const child = spawn(
  process.execPath,
  [path.join(serverRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'watch', '--clear-screen=false', 'src/index.ts'],
  {
    cwd: serverRoot,
    env: process.env,
    stdio: 'inherit',
  }
)
child.on('exit', (code) => process.exit(code ?? 1))
