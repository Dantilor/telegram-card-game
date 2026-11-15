import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import {
  hasNpmBins,
  npmCiIncludeDevArgs,
  npmCiIncludeDevEnv,
  resolveNpmBin,
} from './build-web-sidecar.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(here, '..')
const repoRoot = path.resolve(serverRoot, '..')
const script = path.join(here, 'build-web-sidecar.mjs')

test('build-web-sidecar script exists and parent looks like monorepo', () => {
  assert.equal(fs.existsSync(script), true)
  assert.equal(fs.existsSync(path.join(repoRoot, 'package.json')), true)
  assert.equal(fs.existsSync(path.join(repoRoot, '.env.web')), true)
})

test('build-web-sidecar fails clearly when GNH_BUILD_WEB=1 and parent missing', () => {
  const empty = fs.mkdtempSync(path.join(serverRoot, 'tmp-sidecar-'))
  try {
    const src = fs.readFileSync(script, 'utf8')
    assert.match(src, /GNH_BUILD_WEB/)
    assert.match(src, /web-dist/)
    assert.match(src, /build:web/)
    assert.match(src, /--include=dev/)
    assert.match(src, /node_modules[/\\]\.bin|node_modules', '\.bin'/)
  } finally {
    fs.rmSync(empty, { recursive: true, force: true })
  }
})

test('npm run build:api still available for API-only compile', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(serverRoot, 'package.json'), 'utf8'))
  assert.match(pkg.scripts['build:api'], /typescript\/bin\/tsc/)
  assert.match(pkg.scripts.build, /build-web-sidecar/)
  assert.match(pkg.scripts.build, /typescript\/bin\/tsc/)
})

test('npmCiIncludeDevArgs forces devDependencies during production installs', () => {
  assert.deepEqual(npmCiIncludeDevArgs(), ['ci', '--include=dev'])
})

test('npmCiIncludeDevEnv clears npm production omit under NODE_ENV=production', () => {
  const env = npmCiIncludeDevEnv({ NODE_ENV: 'production', PATH: '/usr/bin', FOO: 'bar' })
  assert.equal(env.NODE_ENV, 'production')
  assert.equal(env.NPM_CONFIG_PRODUCTION, 'false')
  assert.equal(env.npm_config_production, 'false')
  assert.equal(env.FOO, 'bar')
})

test('resolveNpmBin / hasNpmBins require .bin shims, not only package folders', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gnh-sidecar-bins-'))
  try {
    const vitePkg = path.join(tmp, 'node_modules', 'vite')
    fs.mkdirSync(vitePkg, { recursive: true })
    fs.writeFileSync(path.join(vitePkg, 'package.json'), '{"name":"vite"}')
    // Folder exists but .bin/vite does not → treat as missing (Timeweb 127 case).
    assert.equal(resolveNpmBin(tmp, 'vite'), null)
    assert.equal(hasNpmBins(tmp, ['vite', 'tsc']), false)

    const binDir = path.join(tmp, 'node_modules', '.bin')
    fs.mkdirSync(binDir, { recursive: true })
    const viteBin = path.join(binDir, process.platform === 'win32' ? 'vite.cmd' : 'vite')
    const tscBin = path.join(binDir, process.platform === 'win32' ? 'tsc.cmd' : 'tsc')
    fs.writeFileSync(viteBin, process.platform === 'win32' ? '@echo off\n' : '#!/bin/sh\n')
    fs.writeFileSync(tscBin, process.platform === 'win32' ? '@echo off\n' : '#!/bin/sh\n')
    assert.equal(resolveNpmBin(tmp, 'vite'), viteBin)
    assert.equal(resolveNpmBin(tmp, 'tsc'), tscBin)
    assert.equal(hasNpmBins(tmp, ['vite', 'tsc']), true)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('production-like npm ci omit leaves root without vite/.bin (documents exit 127 cause)', () => {
  // Lightweight lockfile probe: root lists vite under devDependencies.
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))
  assert.ok(pkg.devDependencies?.vite, 'vite must stay a root devDependency (build tool)')
  assert.ok(pkg.devDependencies?.typescript, 'tsc must stay a root devDependency (build tool)')
  assert.equal(pkg.dependencies?.vite, undefined)
  assert.equal(pkg.dependencies?.typescript, undefined)
})

test('script source refuses to treat node_modules/vite folder alone as ready', () => {
  const src = fs.readFileSync(script, 'utf8')
  assert.equal(/existsSync\(path\.join\(repoRoot, 'node_modules', 'vite'\)\)/.test(src), false)
  assert.match(src, /resolveNpmBin|hasNpmBins|ensureNpmBins/)
})
