import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import pg from 'pg'
import test from 'node:test'
import type { ConnectionOptions } from 'node:tls'
import { resolvePgPoolConfig } from './dbTls.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(here, '..')
const repoRoot = path.resolve(serverRoot, '..')
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'gnh-tls-unit-'))

function pemFromPowerShell(dns: string, file: string): void {
  const script = `
$cert = New-SelfSignedCertificate -DnsName '${dns}' -CertStoreLocation 'Cert:\\CurrentUser\\My' -KeyAlgorithm RSA -KeyLength 2048 -NotAfter (Get-Date).AddYears(2) -FriendlyName 'gnh-tls-unit'
try {
  $b64 = [Convert]::ToBase64String($cert.RawData, 'InsertLineBreaks')
  $nl = [Environment]::NewLine
  $pem = "-----BEGIN CERTIFICATE-----$nl$b64$nl-----END CERTIFICATE-----$nl"
  [System.IO.File]::WriteAllText('${file.replace(/'/g, "''")}', $pem)
} finally {
  Remove-Item -LiteralPath ('Cert:\\CurrentUser\\My\\' + $cert.Thumbprint) -DeleteKey -Force
}
`
  execFileSync('powershell.exe', ['-NoProfile', '-Command', script], { stdio: 'pipe' })
}

const caFile = path.join(temp, 'ca.crt')
const otherCaFile = path.join(temp, 'other.crt')
const corruptCaFile = path.join(temp, 'corrupt.crt')
pemFromPowerShell('gnh-unit.local', caFile)
pemFromPowerShell('gnh-other.local', otherCaFile)
fs.writeFileSync(corruptCaFile, '-----BEGIN CERTIFICATE-----\nnot-a-certificate\n-----END CERTIFICATE-----\n')

function sslOf(client: pg.Client): ConnectionOptions {
  return client.ssl as ConnectionOptions
}

test('pg would let a URI sslmode replace an explicit strict ssl object', () => {
  const client = new pg.Client({
    connectionString: 'postgresql://gen_user@127.0.0.1:5432/gnh_supabase?sslmode=no-verify',
    ssl: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
  })
  assert.equal(sslOf(client).rejectUnauthorized, false)
})

test('resolver strips weakening URI settings and keeps verification', () => {
  const previous = process.env.PGSSLMODE
  process.env.PGSSLMODE = 'no-verify'
  try {
    const raw = `postgresql://gen_user:a%2Fb%3F@127.0.0.1:5432/gnh_supabase?sslmode=no-verify&uselibpqcompat=true&sslrootcert=${encodeURIComponent(corruptCaFile)}`
    const resolved = resolvePgPoolConfig({
      DATABASE_URL: raw,
      DATABASE_TLS_CA_FILE: caFile,
      DATABASE_TLS_SERVERNAME: 'localhost',
      PGSSLMODE: 'no-verify',
    })
    assert.equal(resolved.connectionString.includes('sslmode'), false)
    assert.equal(resolved.connectionString.includes('sslrootcert'), false)
    assert.equal(resolved.connectionString.includes('uselibpqcompat'), false)
    assert.equal(resolved.connectionString.includes('a%2Fb%3F'), true)
    assert.equal(decodeURIComponent(new URL(resolved.connectionString).password), 'a/b?')
    assert.equal(resolved.ssl.rejectUnauthorized, true)
    assert.equal(resolved.ssl.minVersion, 'TLSv1.2')
    assert.equal(resolved.ssl.servername, 'localhost')
    assert.equal(resolved.ssl.checkServerIdentity, undefined)
    assert.equal(resolved.summary.caSource, 'file')
    assert.match(resolved.summary.caSha256 ?? '', /^[0-9a-f]{64}$/)
    const client = new pg.Client({ connectionString: resolved.connectionString, ssl: resolved.ssl })
    assert.equal(sslOf(client).rejectUnauthorized, true)
    assert.equal(sslOf(client).checkServerIdentity, undefined)
    assert.equal(String(sslOf(client).ca).includes('BEGIN CERTIFICATE'), true)
  } finally {
    if (previous === undefined) delete process.env.PGSSLMODE
    else process.env.PGSSLMODE = previous
  }
})

test('plaintext and disabled verification are refused before a socket exists', () => {
  assert.throws(
    () => resolvePgPoolConfig({ DATABASE_URL: 'postgresql://gen_user@127.0.0.1:5432/db?sslmode=disable' }),
    /without TLS verification/
  )
  assert.throws(
    () => resolvePgPoolConfig({ DATABASE_URL: 'postgresql://gen_user@127.0.0.1:5432/db?ssl=false' }),
    /without TLS verification/
  )
  assert.throws(
    () => resolvePgPoolConfig({
      DATABASE_URL: 'postgresql://gen_user@127.0.0.1:5432/db',
      NODE_TLS_REJECT_UNAUTHORIZED: '0',
    }),
    /NODE_TLS_REJECT_UNAUTHORIZED=0/
  )
})

test('server name and CA failures stay closed', () => {
  assert.throws(
    () => resolvePgPoolConfig({
      DATABASE_URL: 'postgresql://gen_user@localhost:5432/db',
      DATABASE_TLS_SERVERNAME: 'wrong.example',
    }),
    /does not match the database host/
  )
  assert.throws(
    () => resolvePgPoolConfig({ DATABASE_URL: 'postgresql://gen_user@127.0.0.1:5432/db' }),
    /DATABASE_TLS_SERVERNAME is required/
  )
  assert.throws(
    () => resolvePgPoolConfig({
      DATABASE_URL: 'postgresql://gen_user@127.0.0.1:5432/db',
      DATABASE_TLS_SERVERNAME: 'localhost',
      DATABASE_TLS_CA_FILE: path.join(temp, 'missing.crt'),
    }),
    /does not exist/
  )
  assert.throws(
    () => resolvePgPoolConfig({
      DATABASE_URL: 'postgresql://gen_user@127.0.0.1:5432/db',
      DATABASE_TLS_SERVERNAME: 'localhost',
      DATABASE_TLS_CA_FILE: corruptCaFile,
    }),
    /DATABASE_TLS_CA_FILE/
  )
  const pem = fs.readFileSync(caFile, 'utf8')
  const oneLine = pem.trim().replace(/\r\n/g, '\n').replace(/\n/g, '\\n')
  const fromPem = resolvePgPoolConfig({
    DATABASE_URL: 'postgresql://gen_user@127.0.0.1:5432/db',
    DATABASE_TLS_SERVERNAME: 'localhost',
    DATABASE_TLS_CA_PEM: oneLine,
  })
  const fromFile = resolvePgPoolConfig({
    DATABASE_URL: 'postgresql://gen_user@127.0.0.1:5432/db',
    DATABASE_TLS_SERVERNAME: 'localhost',
    DATABASE_TLS_CA_FILE: caFile,
    DATABASE_TLS_CA_PEM: oneLine,
  })
  assert.equal(fromPem.summary.caSource, 'pem')
  assert.equal(fromFile.summary.caSha256, fromPem.summary.caSha256)
  assert.throws(
    () => resolvePgPoolConfig({
      DATABASE_URL: 'postgresql://gen_user@127.0.0.1:5432/db',
      DATABASE_TLS_SERVERNAME: 'localhost',
      DATABASE_TLS_CA_FILE: caFile,
      DATABASE_TLS_CA_PEM: fs.readFileSync(otherCaFile, 'utf8'),
    }),
    /different certificates/
  )
  try {
    resolvePgPoolConfig({
      DATABASE_URL: 'postgresql://gen_user:a%2Fb%3F@127.0.0.1:5432/db',
      DATABASE_TLS_SERVERNAME: 'localhost',
      DATABASE_TLS_CA_FILE: corruptCaFile,
    })
    assert.fail('corrupt CA returned a config')
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    assert.equal(message.includes('a/b?'), false)
    assert.equal(message.includes('BEGIN CERTIFICATE'), false)
  }
})

test('summary entry does not import the pool', () => {
  const source = fs.readFileSync(path.join(serverRoot, 'src/printDatabaseTls.ts'), 'utf8')
  assert.equal(source.includes("from 'pg'"), false)
  assert.equal(source.includes('./db.js'), false)
})

test('Timeweb CA file resolves without opening a connection', () => {
  const ca = path.join(repoRoot, '_private_legal_import', 'timeweb-ca.crt')
  if (!fs.existsSync(ca)) return
  const resolved = resolvePgPoolConfig({
    DATABASE_URL: 'postgresql://gen_user@87c1743b41396e20e77b82cc.twc1.net:5432/gnh_supabase?sslmode=no-verify&sslrootcert=missing-root.crt',
    DATABASE_TLS_CA_FILE: ca,
    DATABASE_TLS_SERVERNAME: '87c1743b41396e20e77b82cc.twc1.net',
    GNH_EXPECT_HOST: '87c1743b41396e20e77b82cc.twc1.net',
    GNH_EXPECT_DATABASE: 'gnh_supabase',
    GNH_EXPECT_USER: 'gen_user',
  })
  assert.equal(resolved.summary.rejectUnauthorized, true)
  assert.equal(resolved.summary.minVersion, 'TLSv1.2')
  assert.equal(resolved.summary.checkServerIdentity, 'default')
  assert.equal(resolved.summary.caSource, 'file')
  assert.equal(resolved.summary.caSha256, '17179badb992feb038426ff31ba66ab7fa711f092ca22705bd7251f3011a124d')
  assert.equal(resolved.summary.servername, '87c1743b41396e20e77b82cc.twc1.net')
  assert.equal(resolved.connectionString.includes('sslmode'), false)
  assert.equal(resolved.ssl.checkServerIdentity, undefined)
})

function redact(text: string): string {
  return text.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
}

function runNode(args: string[], env: NodeJS.ProcessEnv): Promise<{ code: number; stdout: string; stderr: string }> {
  const child = spawn(process.execPath, args, { cwd: serverRoot, env })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk: Buffer) => {
    stdout += chunk.toString('utf8')
  })
  child.stderr.on('data', (chunk: Buffer) => {
    stderr += chunk.toString('utf8')
  })
  return new Promise((resolve, reject) => {
    child.on('error', reject)
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }))
  })
}

test('summary printer does not reveal the CA or the database URL', async () => {
  const summaryEnv = {
    ...process.env,
    DATABASE_URL: 'postgresql://gen_user:secret@127.0.0.1:5432/gnh_supabase?sslmode=no-verify',
    DATABASE_TLS_CA_FILE: caFile,
    DATABASE_TLS_SERVERNAME: 'localhost',
  }
  delete summaryEnv.NODE_TLS_REJECT_UNAUTHORIZED
  const result = await runNode(['--import', 'tsx', path.join(serverRoot, 'src/printDatabaseTls.ts')], summaryEnv)
  assert.equal(result.code, 0, redact(result.stderr))
  assert.equal(result.stdout.includes('BEGIN CERTIFICATE'), false)
  assert.equal(result.stdout.includes('secret'), false)
  assert.equal(result.stdout.includes('postgres'), false)
  const parsed = JSON.parse(result.stdout) as { rejectUnauthorized: boolean; caSource: string; servername: string }
  assert.equal(parsed.rejectUnauthorized, true)
  assert.equal(parsed.caSource, 'file')
  assert.equal(parsed.servername, 'localhost')
})

test('isolated PostgreSQL TLS', { skip: process.env.GNH_TLS_LIVE !== '1' }, async () => {
  const port = process.env.GNH_TLS_PORT
  const liveCa = process.env.GNH_TLS_CA
  const wrongCa = process.env.GNH_TLS_WRONG_CA
  const password = process.env.GNH_TLS_PASSWORD
  if (!port || !liveCa || !wrongCa || !password) throw new Error('live TLS fixture is incomplete')
  if (port === '5432') throw new Error('refusing the default production port')

  const fiction = fs.mkdtempSync(path.join(os.tmpdir(), 'gnh-fiction-legal-'))
  const baseEnv = { ...process.env }
  delete baseEnv.NODE_TLS_REJECT_UNAUTHORIZED
  delete baseEnv.PGSSLMODE
  delete baseEnv.PGSSLROOTCERT
  delete baseEnv.NODE_EXTRA_CA_CERTS
  delete baseEnv.DATABASE_TLS_CA_PEM
  delete baseEnv.PGPASSWORD

  function url(host: string, query = ''): string {
    const built = `postgresql://postgres:${encodeURIComponent(password ?? '')}@${host}:${port}/gnh_supabase${query ? `?${query}` : ''}`
    if (built.includes('twc1.net')) throw new Error('refusing the production host')
    return built
  }

  async function queryCount(env: NodeJS.ProcessEnv): Promise<number> {
    const resolved = resolvePgPoolConfig(env)
    const pool = new pg.Pool({
      connectionString: resolved.connectionString,
      ssl: resolved.ssl,
      max: 1,
      connectionTimeoutMillis: 5000,
    })
    try {
      const result = await pool.query<{ count: string }>('SELECT count(*)::int AS count FROM legal_document_versions')
      return Number(result.rows[0]?.count ?? -1)
    } finally {
      await pool.end()
    }
  }

  try {
    fs.mkdirSync(path.join(fiction, 'markdown'))
    fs.mkdirSync(path.join(fiction, 'docx'))
    const catalog: Record<string, [string, string, boolean]> = {
      offer: ['contract_acceptance', 'checkout', false],
      privacy: ['notice', 'public', false],
      agreement: ['contract_acceptance', 'service', false],
      pd_account: ['personal_data_consent', 'account_operations', false],
      review_publication: ['distribution_consent', 'specific_review', true],
      media_distribution: ['distribution_consent', 'specific_media', true],
      image_permission: ['image_permission', 'specific_media', true],
      marketing_permission: ['advertising_permission', 'selected_channel', false],
      marketing_pd: ['personal_data_consent', 'selected_channel', false],
      analytics: ['personal_data_consent', 'optional_analytics', false],
    }
    const documents = Object.entries(catalog).map(([id, [kind, scope, individual]]) => {
      const body = `FICTIONAL ${id} 2026-01-01.1 NOT AN APPROVED LEGAL DOCUMENT\n`
      const docx = Buffer.from(`FICTIONAL DOCX ${id}\n`)
      fs.writeFileSync(path.join(fiction, 'markdown', `${id}.md`), body)
      fs.writeFileSync(path.join(fiction, 'docx', `${id}.docx`), docx)
      return {
        id,
        version: '2026-01-01.1',
        title: `Fiction ${id}`,
        kind,
        scope,
        document_date: '2026-01-01',
        requires_individual_details: individual,
        sha256: crypto.createHash('sha256').update(body).digest('hex'),
        body_markdown: body,
        blocks: [{ type: 'paragraph', text: body.trim() }],
        markdown_file: `markdown/${id}.md`,
        source_docx: `docx/${id}.docx`,
        source_docx_sha256: crypto.createHash('sha256').update(docx).digest('hex'),
        activate_by_default: false,
      }
    })
    const manifest = path.join(fiction, 'documents.json')
    fs.writeFileSync(manifest, JSON.stringify({
      schema_version: 1,
      hash_algorithm: 'sha256',
      hash_encoding: 'UTF-8',
      hash_field: 'body_markdown',
      documents,
    }))

    const goodEnv: NodeJS.ProcessEnv = {
      ...baseEnv,
      DATABASE_URL: url('localhost'),
      DATABASE_TLS_CA_FILE: liveCa,
      DATABASE_TLS_SERVERNAME: 'localhost',
      GNH_EXPECT_HOST: 'localhost',
      GNH_EXPECT_DATABASE: 'gnh_supabase',
      GNH_EXPECT_USER: 'postgres',
    }
    const probeArgs = ['--import', 'tsx', path.join(serverRoot, 'src/dbTlsProbe.ts')]
    const goodProbe = await runNode(probeArgs, goodEnv)
    assert.equal(goodProbe.code, 0, redact(`${goodProbe.stdout}\n${goodProbe.stderr}`))
    assert.match(goodProbe.stdout, /tls_probe: authorized TLSv1\.[23] session TLSv1\.[23]/)
    assert.equal(`${goodProbe.stdout}\n${goodProbe.stderr}`.includes(password), false)

    const ipEnv: NodeJS.ProcessEnv = {
      ...goodEnv,
      DATABASE_URL: url('127.0.0.1'),
      GNH_EXPECT_HOST: '127.0.0.1',
    }
    const ipProbe = await runNode(probeArgs, ipEnv)
    assert.equal(ipProbe.code, 0, redact(`${ipProbe.stdout}\n${ipProbe.stderr}`))
    assert.match(ipProbe.stdout, /servername localhost/)

    const wrongCaProbe = await runNode(probeArgs, { ...goodEnv, DATABASE_TLS_CA_FILE: wrongCa })
    assert.notEqual(wrongCaProbe.code, 0)
    assert.equal(`${wrongCaProbe.stdout}${wrongCaProbe.stderr}`.includes('tls_probe: authorized'), false)

    const wrongName = await runNode(probeArgs, {
      ...ipEnv,
      DATABASE_TLS_SERVERNAME: 'wrong.invalid',
      DATABASE_URL: url('127.0.0.1', `sslmode=verify-ca&uselibpqcompat=true&sslrootcert=${encodeURIComponent(liveCa)}`),
    })
    assert.notEqual(wrongName.code, 0)
    assert.equal(`${wrongName.stdout}${wrongName.stderr}`.includes('tls_probe: authorized'), false)

    const weakened = await runNode(probeArgs, {
      ...goodEnv,
      PGSSLMODE: 'no-verify',
      DATABASE_URL: url('localhost', `sslmode=no-verify&sslrootcert=${encodeURIComponent(wrongCa)}`),
    })
    assert.equal(weakened.code, 0, redact(`${weakened.stdout}\n${weakened.stderr}`))
    assert.match(weakened.stdout, /tls_probe: authorized/)

    const ignoredGoodRoot = await runNode(probeArgs, {
      ...goodEnv,
      DATABASE_TLS_CA_FILE: wrongCa,
      PGSSLMODE: 'no-verify',
      DATABASE_URL: url('localhost', `sslmode=no-verify&sslrootcert=${encodeURIComponent(liveCa)}`),
    })
    assert.notEqual(ignoredGoodRoot.code, 0)
    assert.equal(`${ignoredGoodRoot.stdout}${ignoredGoodRoot.stderr}`.includes('tls_probe: authorized'), false)

    const cli = ['--import', 'tsx', path.join(serverRoot, 'src/legal/cli.ts')]
    const dry = await runNode([...cli, 'import', '--file', manifest], goodEnv)
    assert.equal(dry.code, 0, redact(dry.stderr))
    assert.match(dry.stdout, /database: not contacted/)
    assert.equal(`${dry.stdout}\n${dry.stderr}`.includes('[DB]'), false)

    const corrupt = path.join(fiction, 'corrupt.crt')
    fs.writeFileSync(corrupt, 'broken-ca')
    const corruptRun = await runNode([...cli, 'import', '--file', manifest, '--write'], {
      ...goodEnv,
      DATABASE_TLS_CA_FILE: corrupt,
    })
    assert.notEqual(corruptRun.code, 0)
    assert.match(`${corruptRun.stdout}\n${corruptRun.stderr}`, /DATABASE_TLS_CA_FILE/)
    assert.equal(`${corruptRun.stdout}${corruptRun.stderr}`.includes('mode: write'), false)
    assert.equal(await queryCount(goodEnv), 0)

    const missing = await runNode([...cli, 'import', '--file', manifest, '--write'], {
      ...goodEnv,
      DATABASE_TLS_CA_FILE: path.join(fiction, 'missing.crt'),
    })
    assert.notEqual(missing.code, 0)
    assert.match(`${missing.stdout}\n${missing.stderr}`, /does not exist/)
    assert.equal(await queryCount(goodEnv), 0)

    const check = ['--import', 'tsx', path.join(serverRoot, 'src/legal/documentCheck.ts')]
    const preflight = await runNode([...check, 'preflight'], goodEnv)
    assert.equal(preflight.code, 0, redact(`${preflight.stdout}\n${preflight.stderr}`))
    assert.match(preflight.stdout, /current_database: gnh_supabase/)
    assert.match(preflight.stdout, /current_user: postgres/)
    assert.match(preflight.stdout, /ssl: true/)
    assert.match(preflight.stdout, /tls_version: TLSv1\.[23]/)
    assert.match(preflight.stdout, /legal_tables: 5/)

    const imported = await runNode([...cli, 'import', '--file', manifest, '--write'], goodEnv)
    assert.equal(imported.code, 0, redact(`${imported.stdout}\n${imported.stderr}`))
    assert.match(imported.stdout, /mode: write/)
    assert.match(imported.stdout, /activation: not performed/)
    assert.equal(imported.stdout.includes('FICTIONAL'), false)
    const again = await runNode([...cli, 'import', '--file', manifest, '--write'], goodEnv)
    assert.equal(again.code, 0, redact(`${again.stdout}\n${again.stderr}`))
    assert.match(again.stdout, /unchanged:/)
    assert.match(again.stdout, /activation: not performed/)

    const verified = await runNode([...check, 'verify-import', '--file', manifest], goodEnv)
    assert.equal(verified.code, 0, redact(`${verified.stdout}\n${verified.stderr}`))
    assert.equal((verified.stdout.match(/sha256=[0-9a-f]{64}/g) ?? []).length, 10)
    assert.match(verified.stdout, /activations: 0/)
    assert.match(verified.stdout, /evidence: 0/)
    assert.match(verified.stdout, /preferences: 0/)
    assert.match(verified.stdout, /queue: 0/)
    assert.match(verified.stdout, /content: match/)
    assert.equal(verified.stdout.includes('FICTIONAL'), false)
  } finally {
    fs.rmSync(fiction, { recursive: true, force: true })
  }
})

test.after(() => {
  fs.rmSync(temp, { recursive: true, force: true })
})
