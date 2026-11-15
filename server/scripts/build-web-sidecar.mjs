#!/usr/bin/env node
/**
 * Build WEB (dist-web) from the monorepo root while Timeweb Project directory is `/server`.
 *
 * Timeweb App "gamenight-api" / Stand GNH-WEB-Test uses:
 *   Project directory: /server
 *   Build: npm run build
 *   Start: npm start
 *   NODE_ENV=production during install+build (omits root/server devDependencies by default)
 *
 * Free stands on feature/gnh-web-standalone keep those Timeweb settings unchanged.
 * This script runs as part of `npm run build` in /server, reaches `../`, installs
 * frontend build tools with `npm ci --include=dev` when needed, builds WEB,
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

/** @param {string} root @param {string} name */
export function resolveNpmBin(root, name) {
  const binDir = path.join(root, 'node_modules', '.bin')
  if (process.platform === 'win32') {
    for (const candidate of [`${name}.cmd`, `${name}.ps1`, name]) {
      const full = path.join(binDir, candidate)
      if (fs.existsSync(full)) return full
    }
    return null
  }
  const plain = path.join(binDir, name)
  return fs.existsSync(plain) ? plain : null
}

/** @param {string} root @param {string[]} names */
export function hasNpmBins(root, names) {
  return names.every((name) => Boolean(resolveNpmBin(root, name)))
}

/** Env for install that must include devDependencies even when NODE_ENV=production. */
export function npmCiIncludeDevEnv(baseEnv = process.env) {
  return {
    ...baseEnv,
    // npm respects these during ci/install; keep caller's NODE_ENV for later vite/tsc build.
    NPM_CONFIG_PRODUCTION: 'false',
    npm_config_production: 'false',
  }
}

export function npmCiIncludeDevArgs() {
  // npm 7+: --include=dev overrides production omission from NODE_ENV=production.
  return ['ci', '--include=dev']
}

function looksLikeFrontendRoot(dir) {
  return (
    fs.existsSync(path.join(dir, 'package.json')) &&
    (fs.existsSync(path.join(dir, 'vite.config.js')) || fs.existsSync(path.join(dir, 'vite.config.ts'))) &&
    fs.existsSync(path.join(dir, 'src')) &&
    fs.existsSync(path.join(dir, '.env.web'))
  )
}

function run(cmd, args, cwd, env = process.env) {
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    env,
    // Windows needs shell so `npm` resolves; Linux/Timeweb uses argv directly.
    shell: process.platform === 'win32',
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed with code ${result.status}`)
  }
}

/**
 * Ensure package-lock install includes build tool bins (tsc/vite/…).
 * Reuses existing node_modules only when the required .bin shims exist.
 */
export function ensureNpmBins(root, binNames, { label, npmCmd = 'npm' } = {}) {
  const missing = binNames.filter((name) => !resolveNpmBin(root, name))
  if (missing.length === 0) {
    console.log(`[build-web-sidecar] Reusing ${label} node_modules (.bin: ${binNames.join(', ')})`)
    return { installed: false, bins: binNames.map((name) => resolveNpmBin(root, name)) }
  }
  console.log(
    `[build-web-sidecar] ${label} missing build bins (${missing.join(', ')}); running npm ci --include=dev…`
  )
  const lock = path.join(root, 'package-lock.json')
  if (!fs.existsSync(lock)) {
    throw new Error(`[build-web-sidecar] ${label}: package-lock.json missing at ${lock}`)
  }
  run(npmCmd, npmCiIncludeDevArgs(), root, npmCiIncludeDevEnv())
  const stillMissing = binNames.filter((name) => !resolveNpmBin(root, name))
  if (stillMissing.length) {
    throw new Error(
      `[build-web-sidecar] ${label}: still missing ${stillMissing.join(', ')} under node_modules/.bin after npm ci --include=dev (exit would have been 127 on build)`
    )
  }
  return { installed: true, bins: binNames.map((name) => resolveNpmBin(root, name)) }
}

function main() {
  const npmCmd = 'npm'

  console.log('[build-web-sidecar] serverRoot =', serverRoot)
  console.log('[build-web-sidecar] repoRoot   =', repoRoot)
  console.log('[build-web-sidecar] NODE_ENV   =', process.env.NODE_ENV || '(unset)')

  // Server `npm run build` continues with `tsc` after this script — ensure it exists under /server.
  ensureNpmBins(serverRoot, ['tsc'], { label: 'server', npmCmd })

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

  // Root build:web runs `tsc -b && vite build --mode web` — both are root devDependencies.
  ensureNpmBins(repoRoot, ['tsc', 'vite'], { label: 'frontend', npmCmd })

  console.log('[build-web-sidecar] Building WEB…')
  run(npmCmd, ['run', 'build:web'], repoRoot)

  const distWeb = path.join(repoRoot, 'dist-web')
  if (!fs.existsSync(path.join(distWeb, 'index.html'))) {
    console.error('[build-web-sidecar] dist-web/index.html missing after build')
    process.exit(1)
  }

  fs.rmSync(outDir, { recursive: true, force: true })
  fs.mkdirSync(outDir, { recursive: true })
  fs.cpSync(distWeb, outDir, { recursive: true })
  console.log('[build-web-sidecar] Copied WEB assets →', outDir)

  if (!fs.existsSync(path.join(outDir, 'index.html'))) {
    console.error('[build-web-sidecar] server/web-dist/index.html missing after copy')
    process.exit(1)
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) {
  try {
    main()
  } catch (err) {
    console.error('[build-web-sidecar]', err instanceof Error ? err.message : err)
    process.exit(1)
  }
}
