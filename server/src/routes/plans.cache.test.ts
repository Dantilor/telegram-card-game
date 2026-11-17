import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

describe('plans cache safety', () => {
  it('forces revalidation for priced plans while keeping ETag', () => {
    const source = readFileSync(join(process.cwd(), 'src/routes/plans.ts'), 'utf8')
    assert.match(source, /setHeader\('Cache-Control', 'no-cache'\)/)
    assert.doesNotMatch(source, /setHeader\('Cache-Control', '[^']*stale-while-revalidate/)
    assert.match(source, /setHeader\('ETag'/)
  })

  it('keeps checkout on live getActivePlanById rather than the catalog cache', () => {
    const yookassa = readFileSync(join(process.cwd(), 'src/routes/yookassa.ts'), 'utf8')
    const catalog = readFileSync(join(process.cwd(), 'src/services/plansCatalog.ts'), 'utf8')
    assert.match(yookassa, /getActivePlanById/)
    assert.doesNotMatch(yookassa, /getPlansCatalog/)
    assert.match(catalog, /Checkout never reads this/)
  })
})
