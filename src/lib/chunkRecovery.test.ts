import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isChunkLoadError, shouldReloadForChunkError } from './chunkRecovery'

describe('safe game loading across deployments', () => {
  it('recognizes failed dynamic game imports but ignores ordinary API errors', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /assets/MafiaLayout-dead.js'))).toBe(true)
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true)
    expect(isChunkLoadError(new Error('Loading chunk 123 failed.'))).toBe(true)
    expect(isChunkLoadError(new Error('API 401: initData required'))).toBe(false)
    expect(isChunkLoadError(new Error('Сеть недоступна'))).toBe(false)
  })

  it('reloads once for a missing chunk and then blocks a loop', () => {
    expect(shouldReloadForChunkError(200_000, null, null)).toBe(true)
    expect(shouldReloadForChunkError(200_000, 199_000, null)).toBe(false)
    expect(shouldReloadForChunkError(200_000, null, 199_000)).toBe(false)
    expect(shouldReloadForChunkError(200_000, 50_000, 199_000)).toBe(false)
    expect(shouldReloadForChunkError(200_000, 100_000, null)).toBe(true)
  })

  it('preserves prior hashed assets on both static targets', () => {
    const workflow = readFileSync(resolve(process.cwd(), '.github/workflows/deploy.yml'), 'utf8')
    expect(workflow.match(/keep_files: true/g)).toHaveLength(2)
    const app = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8')
    expect(app).toMatch(/<PlayErrorBoundary>\s*<Play\s*\/>/)
    const entry = readFileSync(resolve(process.cwd(), 'src/main.tsx'), 'utf8')
    expect(entry).toMatch(/installChunkRecovery\(\)/)
  })
})
