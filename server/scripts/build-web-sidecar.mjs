#!/usr/bin/env node
/**
 * Build WEB (dist-web) from the monorepo root while Timeweb Project directory is `/server`.
 *
 * Timeweb App "gamenight-api" uses:
 *   Project directory: /server
 *   Build: npm run build
 *   Start: npm start
 *
 * Free stands on feature/gnh-web-standalone keep those Timeweb settings unchanged.
 * This script runs as part of `npm run build` in /server, reaches `../`, builds WEB,
 * and copies artifacts into `server/web-dist` for same-origin Express static serving.
 *
 * Skip (no failure) when the parent tree is not a GNH frontend checkout
 * (keeps local API-only workflows working).
 * Fail hard when GNH_BUILD_WEB=1 and the parent tree is missing.
 */

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(serverRoot, '..')
const force = process.env.GNH_BUILD_WEB === '1' || process.env.GNH_BUILD_WEB === 'true'
const outDir = path.join(serverRoot, 'web-dist')

function looksLikeFrontendRoot(dir) {
  return (
    fs.existsSync(path.join(dir, 'package.json')) &&
    (fs.existsSync(path.join(dir, 'vite.config.js')) || fs.existsSync(path.join(dir, 'vite.config.ts'))) &&
    fs.existsSync(path.join(dir, 'src')) &&
    fs.existsSync(path.join(dir, '.env.web'))
  )
}

function run(cmd, args, cwd) {
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
    // Windows needs shell so `npm` resolves; Linux/Timeweb uses argv directly.
    shell: process.platform === 'win32',
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed with code ${result.status}`)
  }
}

const npmCmd = 'npm'

console.log('[build-web-sidecar] serverRoot =', serverRoot)
console.log('[build-web-sidecar] repoRoot   =', repoRoot)

if (!looksLikeFrontendRoot(repoRoot)) {
  const msg =
    '[build-web-sidecar] Parent checkout is not a GNH WEB frontend (missing vite/.env.web/src).'
  if (force) {
    console.error(msg)
    console.error('[build-web-sidecar] GNH_BUILD_WEB=1 requires monorepo root above /server.')
    process.exit(1)
  }
  console.warn(msg, 'Skipping WEB build.')
  process.exit(0)
}

const distWeb = path.join(repoRoot, 'dist-web')
const hasVite = fs.existsSync(path.join(repoRoot, 'node_modules', 'vite'))
if (hasVite) {
  console.log('[build-web-sidecar] Reusing existing frontend node_modules')
} else {
  console.log('[build-web-sidecar] Installing frontend deps (npm ci)…')
  run(npmCmd, ['ci'], repoRoot)
}
console.log('[build-web-sidecar] Building WEB…')
run(npmCmd, ['run', 'build:web'], repoRoot)

if (!fs.existsSync(path.join(distWeb, 'index.html'))) {
  console.error('[build-web-sidecar] dist-web/index.html missing after build')
  process.exit(1)
}

fs.rmSync(outDir, { recursive: true, force: true })
fs.mkdirSync(outDir, { recursive: true })
fs.cpSync(distWeb, outDir, { recursive: true })
console.log('[build-web-sidecar] Copied WEB assets →', outDir)
