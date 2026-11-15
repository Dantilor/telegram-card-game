import assert from 'node:assert/strict'
import test from 'node:test'
import {
  inspectDatabaseUrlFormat,
  logStagingDatabaseUrlFormat,
  normalizeDatabaseUrlInput,
  stagingDatabaseUrlRemediation,
} from './databaseUrlFormat.js'
import { resolvePgPoolConfig } from './dbTls.js'

const good = 'postgresql://gnh_web_stage:p%40ss@db.example:5432/gnh_web_staging?sslmode=verify-full'

test('inspect detects missing DATABASE_URL', () => {
  const report = inspectDatabaseUrlFormat(undefined)
  assert.equal(report.present, false)
  assert.deepEqual(report.issues, ['missing'])
})

test('inspect detects CR/LF, quotes, prefix, and edge whitespace', () => {
  const report = inspectDatabaseUrlFormat(`  DATABASE_URL="${good}"\r\n`)
  assert.equal(report.present, true)
  assert.equal(report.hasCr, true)
  assert.equal(report.hasLf, true)
  assert.equal(report.hasWrappingQuotes, true)
  assert.equal(report.hasEnvAssignmentPrefix, true)
  assert.equal(report.hasEdgeWhitespace, true)
  assert.equal(report.nodeUrlParseOk, true)
  assert.equal(report.protocolRecognized, true)
  assert.equal(report.normalized, true)
})

test('normalize strips Timeweb paste artifacts and keeps URL parseable', () => {
  const { value, report } = normalizeDatabaseUrlInput(`\r\nDATABASE_URL='${good}'\n`)
  assert.equal(value, good)
  assert.equal(report.hasLf, true)
  assert.equal(report.hasCr, true)
  assert.equal(report.hasWrappingQuotes, true)
  assert.equal(report.hasEnvAssignmentPrefix, true)
  assert.equal(report.nodeUrlParseOk, true)
  assert.equal(value.includes('\n'), false)
  assert.equal(value.includes('\r'), false)
  assert.equal(value.includes('DATABASE_URL='), false)
})

test('normalize refuses embedded mid-value newline', () => {
  // Node WHATWG URL silently strips the newline and concatenates path segments —
  // we must refuse before that corruption reaches pg.
  const broken = 'postgresql://u:p@h:5432/gnh_web_staging\nmore'
  const { value, report } = normalizeDatabaseUrlInput(broken)
  assert.equal(value.includes('\n'), true)
  assert.ok(report.issues.includes('embedded_newline'))
  assert.ok(report.issues.includes('contains_lf'))
  assert.throws(
    () => resolvePgPoolConfig({ DATABASE_URL: broken, GNH_STAGING: '1' }),
    /embedded newline|could not be parsed/
  )
})

test('invalid URL format is reported without echoing secrets', () => {
  const report = inspectDatabaseUrlFormat('not-a-url://secret-password-should-not-leak')
  assert.equal(report.protocolRecognized, false)
  const lines: string[] = []
  logStagingDatabaseUrlFormat(report, { GNH_STAGING: '1' }, (line) => lines.push(line))
  const joined = lines.join('\n')
  assert.match(joined, /staging url_format/)
  assert.equal(joined.includes('secret-password'), false)
  assert.equal(joined.includes('not-a-url'), false)
  const tips = stagingDatabaseUrlRemediation(report)
  assert.ok(tips.some((t) => /postgresql:\/\//i.test(t) || /postgres protocol/i.test(t) || /URL-encode/i.test(t)))
  assert.equal(tips.join(' ').includes('secret-password'), false)
})

test('resolvePgPoolConfig accepts trailing newline after safe normalize', () => {
  const resolved = resolvePgPoolConfig({
    DATABASE_URL: `${good}\n`,
    GNH_STAGING: '1',
    GNH_EXPECT_HOST: 'db.example',
    GNH_EXPECT_DATABASE: 'gnh_web_staging',
    DATABASE_TLS_CA_PEM: undefined,
  })
  assert.equal(resolved.summary.host, 'db.example')
  assert.equal(resolved.summary.database, 'gnh_web_staging')
  assert.equal(resolved.summary.rejectUnauthorized, true)
  assert.equal(resolved.connectionString.includes('\n'), false)
})

test('resolvePgPoolConfig accepts wrapping quotes after safe normalize', () => {
  const resolved = resolvePgPoolConfig({
    DATABASE_URL: `"${good}"`,
    GNH_STAGING: '1',
  })
  assert.equal(resolved.summary.database, 'gnh_web_staging')
  assert.equal(resolved.ssl.rejectUnauthorized, true)
})

test('resolvePgPoolConfig still refuses plaintext TLS settings', () => {
  assert.throws(
    () =>
      resolvePgPoolConfig({
        DATABASE_URL: 'postgresql://u:p@db.example:5432/gnh_web_staging?sslmode=disable\n',
        GNH_STAGING: '1',
      }),
    /without TLS verification/
  )
})

test('staging remediation never includes the URL value', () => {
  const report = inspectDatabaseUrlFormat(`"${good}"\n`)
  const tips = stagingDatabaseUrlRemediation(report).join('\n')
  assert.equal(tips.includes('gnh_web_stage'), false)
  assert.equal(tips.includes('p%40ss'), false)
  assert.equal(tips.includes(good), false)
})
