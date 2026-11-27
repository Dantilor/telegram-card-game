import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import {
  MINIAPP_BUILD_NODE_ENV,
  findDevelopmentMarkers,
  hasViteEnvLiteral,
  withProductionBuildEnv,
} from './miniapp-build-mode.mjs'

const scriptsDir = path.dirname(fileURLToPath(import.meta.url))
const API = 'https://dantilor-telegram-card-game-3706.twc1.net'

const PROD_JS =
  `const e={BASE_URL:"/",DEV:!1,LEGACY:!1,MODE:"production",PROD:!0,SSR:!1,VITE_API_BASE:"${API}",VITE_API_URL:"${API}"};` +
  `const link="https://play.gamenighthost.ru/";x.jsx("div",{});x.jsxs("div",{});`
const DEV_JS =
  `const e={BASE_URL:"/",DEV:!0,LEGACY:!1,MODE:"production",PROD:!1,SSR:!1,VITE_API_BASE:"${API}",VITE_API_URL:"${API}"};` +
  `const link="https://play.gamenighthost.ru/";x.jsxDEV("div",{},void 0,!1,{fileName:"C:/Users/me/app/src/A.tsx",lineNumber:1},this);` +
  `/** @license React react.development.js */`

const tmpDirs: string[] = []
function fakeDist(js: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gnh-fake-dist-'))
  tmpDirs.push(dir)
  fs.mkdirSync(path.join(dir, 'assets'))
  fs.writeFileSync(
    path.join(dir, 'index.html'),
    '<script type="module" src="/assets/index-abc.js"></script><link rel="stylesheet" href="/assets/index-abc.css">'
  )
  fs.writeFileSync(path.join(dir, 'assets', 'index-abc.css'), 'a{}')
  fs.writeFileSync(path.join(dir, 'assets', 'index-abc.js'), js)
  return dir
}

function runDistCheck(dir: string) {
  return spawnSync(process.execPath, [path.join(scriptsDir, 'check-miniapp-dist.mjs'), dir], { encoding: 'utf8' })
}

afterEach(() => {
  while (tmpDirs.length) fs.rmSync(tmpDirs.pop()!, { recursive: true, force: true })
})

describe('Mini App production build mode', () => {
  it('forces NODE_ENV=production even when the terminal says development', () => {
    const inherited = { NODE_ENV: 'development', PATH: 'x', VITE_API_URL: API }
    const env = withProductionBuildEnv(inherited)
    expect(env.NODE_ENV).toBe('production')
    expect(MINIAPP_BUILD_NODE_ENV).toBe('production')
    expect(env.PATH).toBe('x')
    expect(env.VITE_API_URL).toBe(API)
    // source env object (and thus the OS environment) is not mutated
    expect(inherited.NODE_ENV).toBe('development')
  })

  it('sets NODE_ENV when it is missing or test', () => {
    expect(withProductionBuildEnv({}).NODE_ENV).toBe('production')
    expect(withProductionBuildEnv({ NODE_ENV: 'test' }).NODE_ENV).toBe('production')
  })

  it('accepts production output and flags development output', () => {
    expect(hasViteEnvLiteral(PROD_JS)).toBe(true)
    expect(findDevelopmentMarkers(PROD_JS)).toEqual([])
    const issues = findDevelopmentMarkers(DEV_JS)
    expect(issues).toContain('import.meta.env DEV is true')
    expect(issues).toContain('import.meta.env PROD is false')
    expect(issues).toContain('development JSX runtime (jsxDEV) present')
    expect(issues).toContain('React development build banner (react*.development.js) present')
  })

  it('does not trust MODE alone: MODE:"production" with DEV:true is rejected', () => {
    const js = `const e={BASE_URL:"/",DEV:!0,MODE:"production",PROD:!1};`
    expect(findDevelopmentMarkers(js).length).toBeGreaterThan(0)
  })

  it('check-miniapp-dist accepts a production dist', () => {
    const res = runDistCheck(fakeDist(PROD_JS))
    expect(res.stderr).toBe('')
    expect(res.status).toBe(0)
  })

  it('check-miniapp-dist rejects an accidental development dist', () => {
    const res = runDistCheck(fakeDist(DEV_JS))
    expect(res.status).toBe(1)
    expect(res.stderr).toContain('Development build detected')
  })

  it('check-miniapp-dist rejects a dist without a verifiable import.meta.env literal', () => {
    const js = `const a="${API}";VITE_API_URL:"${API}";VITE_API_BASE:"${API}";"https://play.gamenighthost.ru/"`
    const res = runDistCheck(fakeDist(js))
    expect(res.status).toBe(1)
  })
})