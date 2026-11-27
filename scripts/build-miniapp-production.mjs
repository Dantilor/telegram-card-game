import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MINIAPP_PROD_API_ORIGIN, MINIAPP_PROD_BASE } from './miniapp-production-config.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
process.chdir(root)

function run(cmd, args, opts = {}) {
  console.log('>', [cmd, ...args].join(' '))
  const res = spawnSync(cmd, args, {
    stdio: 'inherit',
    // Avoid shell splitting on Windows paths with spaces (Program Files).
    shell: false,
    env: { ...process.env, ...(opts.env || {}) },
    ...opts,
  })
  if (res.error) {
    console.error(res.error)
    process.exit(1)
  }
  if (res.status !== 0) process.exit(res.status ?? 1)
}

function runNpm(args) {
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  console.log('>', npmCmd, args.join(' '))
  const res = spawnSync(npmCmd, args, { stdio: 'inherit', shell: true, env: process.env })
  if (res.status !== 0) process.exit(res.status ?? 1)
}

process.env.VITE_API_URL = MINIAPP_PROD_API_ORIGIN
process.env.VITE_API_BASE = MINIAPP_PROD_API_ORIGIN
process.env.VITE_API_BASE_URL = MINIAPP_PROD_API_ORIGIN
delete process.env.VITE_GNH_SHELL
delete process.env.VITE_GNH_METRIKA_ENABLED

run(process.execPath, ['scripts/check-miniapp-build-env.mjs', '--require-prod'])
run(process.execPath, [
  path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
  '-b',
  '--pretty',
  'false',
])
run(process.execPath, [
  path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'),
  'build',
  `--base=${MINIAPP_PROD_BASE}`,
])
run(process.execPath, ['scripts/check-miniapp-dist.mjs', 'dist'])

const html = fs.readFileSync(path.join(root, 'dist', 'index.html'), 'utf8')
const js = (html.match(/assets\/(index-[^"']+\.js)/) || [])[1]
const css = (html.match(/assets\/(index-[^"']+\.css)/) || [])[1]
const jsBytes = js ? fs.statSync(path.join(root, 'dist', 'assets', js)).size : 0
const cssBytes = css ? fs.statSync(path.join(root, 'dist', 'assets', css)).size : 0
console.log('[build-miniapp-production] DONE', {
  api: MINIAPP_PROD_API_ORIGIN,
  base: MINIAPP_PROD_BASE,
  entryJs: js,
  entryCss: css,
  jsBytes,
  cssBytes,
})
