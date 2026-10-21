import fs from 'node:fs'
import net from 'node:net'
import type { ConnectionOptions } from 'node:tls'
import { X509Certificate } from 'node:crypto'

/**
 * TLS settings for the shared pg pool used by the API and the legal CLI.
 *
 * DATABASE_TLS_CA_FILE is a local PEM path. DATABASE_TLS_CA_PEM is the same
 * public CA for an environment field: real newlines, or one line whose
 * certificate breaks are the two characters "\" and "n". If both are set,
 * they must be the same certificates. A missing or invalid CA is an error
 * and never turns verification off. Without either variable, Node's default
 * trust store is used and certificate checks stay enabled.
 *
 * pg 8.18 copies SSL fields out of the connection URI over an explicit ssl
 * object, including rejectUnauthorized=false for sslmode=no-verify. Those
 * URI fields are removed before pg sees the string. sslmode=disable and
 * ssl=false are refused rather than turned into a plaintext connection.
 * For a DNS host, this pg version then sets the TLS server name from that
 * host, so DATABASE_TLS_SERVERNAME must match it. An IP host keeps the
 * explicit server name because pg does not replace it.
 */

const SSL_QUERY_KEYS = new Set([
  'ssl',
  'sslmode',
  'sslcert',
  'sslkey',
  'sslrootcert',
  'sslpassword',
  'sslcrl',
  'uselibpqcompat',
  'sslnegotiation',
  'sslcompression',
  'ssl_min_protocol_version',
])

const PLAINTEXT_SSL = new Set(['0', 'false', 'off', 'disable', 'no', 'allow'])

export type DatabaseTlsSummary = {
  rejectUnauthorized: true
  minVersion: 'TLSv1.2'
  servername: string
  checkServerIdentity: 'default'
  caSource: 'file' | 'pem' | 'system'
  caSha256: string | null
  host: string
  port: string
  database: string
  user: string
}

export type ResolvedDatabaseConnection = {
  connectionString: string
  ssl: ConnectionOptions
  summary: DatabaseTlsSummary
}

function fail(message: string): never {
  throw new Error(message)
}

function parseUrl(raw: string): URL {
  try {
    return new URL(raw)
  } catch {
    fail('DATABASE_URL could not be parsed')
  }
}

function stripSslQuery(raw: string): string {
  const hash = raw.indexOf('#')
  const withoutHash = hash === -1 ? raw : raw.slice(0, hash)
  const queryAt = withoutHash.indexOf('?')
  if (queryAt === -1) return withoutHash
  const prefix = withoutHash.slice(0, queryAt)
  const kept = withoutHash
    .slice(queryAt + 1)
    .split('&')
    .filter((part) => {
      if (!part) return false
      const name = part.split('=')[0] ?? ''
      let decoded = name
      try {
        decoded = decodeURIComponent(name.replace(/\+/g, ' '))
      } catch {
        decoded = name
      }
      return !SSL_QUERY_KEYS.has(decoded.toLowerCase())
    })
  return kept.length > 0 ? `${prefix}?${kept.join('&')}` : prefix
}

function decodePemText(value: string): string {
  let text = value.trim()
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1)
  }
  text = text.replace(/\r\n/g, '\n')
  if (!text.includes('\n') && text.includes('\\n')) {
    text = text.replace(/\\n/g, '\n')
  }
  return text
}

function certificatesFromPem(pem: string, label: string): X509Certificate[] {
  const blocks = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g)
  if (!blocks || blocks.length === 0) fail(`${label} does not contain a PEM certificate`)
  return blocks.map((block) => {
    try {
      return new X509Certificate(block)
    } catch {
      fail(`${label} is not a valid X.509 certificate`)
    }
  })
}

function sameCertificates(left: X509Certificate[], right: X509Certificate[]): boolean {
  if (left.length !== right.length) return false
  return left.every((cert, index) => {
    const other = right[index]
    return other !== undefined && cert.raw.length === other.raw.length && cert.raw.equals(other.raw)
  })
}

function fingerprint(cert: X509Certificate): string {
  return cert.fingerprint256.replace(/:/g, '').toLowerCase()
}

function loadCustomCa(env: NodeJS.ProcessEnv): { pem: string | undefined; source: 'file' | 'pem' | 'system'; sha256: string | null } {
  const fileValue = env.DATABASE_TLS_CA_FILE
  const pemValue = env.DATABASE_TLS_CA_PEM
  if (fileValue !== undefined && fileValue.trim() === '') fail('DATABASE_TLS_CA_FILE is empty')
  if (pemValue !== undefined && pemValue.trim() === '') fail('DATABASE_TLS_CA_PEM is empty')

  let fileCerts: X509Certificate[] | undefined
  if (fileValue !== undefined) {
    const filePath = fileValue.trim()
    let stat: fs.Stats
    try {
      stat = fs.statSync(filePath)
    } catch {
      fail('DATABASE_TLS_CA_FILE does not exist')
    }
    if (!stat.isFile()) fail('DATABASE_TLS_CA_FILE is not a file')
    let text = ''
    try {
      text = fs.readFileSync(filePath, 'utf8')
    } catch {
      fail('DATABASE_TLS_CA_FILE could not be read')
    }
    fileCerts = certificatesFromPem(text, 'DATABASE_TLS_CA_FILE')
  }

  let pemCerts: X509Certificate[] | undefined
  if (pemValue !== undefined) {
    pemCerts = certificatesFromPem(decodePemText(pemValue), 'DATABASE_TLS_CA_PEM')
  }

  if (fileCerts && pemCerts && !sameCertificates(fileCerts, pemCerts)) {
    fail('DATABASE_TLS_CA_FILE and DATABASE_TLS_CA_PEM contain different certificates')
  }

  const selected = fileCerts ?? pemCerts
  if (!selected) return { pem: undefined, source: 'system', sha256: null }
  const pem = selected.map((cert) => cert.toString()).join('\n') + '\n'
  const first = selected[0]
  if (!first) fail('DATABASE_TLS CA is empty')
  return {
    pem,
    source: fileCerts ? 'file' : 'pem',
    sha256: fingerprint(first),
  }
}

function expectEqual(actual: string, expected: string | undefined, message: string): void {
  if (expected !== undefined && expected.trim() !== '' && actual.toLowerCase() !== expected.trim().toLowerCase()) {
    fail(message)
  }
}

export function resolvePgPoolConfig(env: NodeJS.ProcessEnv = process.env): ResolvedDatabaseConnection {
  if (env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    fail('NODE_TLS_REJECT_UNAUTHORIZED=0 is refused because it disables certificate verification')
  }
  const rawUrl = env.DATABASE_URL
  if (!rawUrl || rawUrl.trim() === '') fail('DATABASE_URL is required')
  if (rawUrl.includes('\n') || rawUrl.includes('\r')) fail('DATABASE_URL could not be parsed')

  const original = parseUrl(rawUrl)
  if (original.protocol !== 'postgres:' && original.protocol !== 'postgresql:') {
    fail('DATABASE_URL must use the postgres protocol')
  }
  const sslmode = (original.searchParams.get('sslmode') ?? '').toLowerCase()
  const sslFlag = (original.searchParams.get('ssl') ?? '').toLowerCase()
  if (sslmode === 'disable' || PLAINTEXT_SSL.has(sslFlag)) {
    fail('DATABASE_URL requests a connection without TLS verification')
  }

  const connectionString = stripSslQuery(rawUrl)
  const parsed = parseUrl(connectionString)
  const host = parsed.hostname
  if (!host) fail('DATABASE_URL host is missing')
  const port = parsed.port || '5432'
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''))
  if (!database || database.includes('/')) fail('DATABASE_URL database is missing')
  const user = decodeURIComponent(parsed.username)
  if (!user) fail('DATABASE_URL user is missing')

  expectEqual(host, env.GNH_EXPECT_HOST, 'database host does not match GNH_EXPECT_HOST')
  expectEqual(database, env.GNH_EXPECT_DATABASE, 'database name does not match GNH_EXPECT_DATABASE')
  expectEqual(user, env.GNH_EXPECT_USER, 'database user does not match GNH_EXPECT_USER')

  const requestedServer = env.DATABASE_TLS_SERVERNAME?.trim()
  const hostIsIp = net.isIP(host) !== 0
  let servername: string
  if (hostIsIp) {
    if (!requestedServer) fail('DATABASE_TLS_SERVERNAME is required when DATABASE_URL uses an IP address')
    servername = requestedServer
  } else if (requestedServer && requestedServer.toLowerCase() !== host.toLowerCase()) {
    fail('DATABASE_TLS_SERVERNAME does not match the database host')
  } else {
    servername = host
  }

  const ca = loadCustomCa(env)
  const ssl: ConnectionOptions = {
    rejectUnauthorized: true,
    minVersion: 'TLSv1.2',
    servername,
  }
  if (ca.pem) ssl.ca = ca.pem
  if (ssl.rejectUnauthorized !== true || ssl.minVersion !== 'TLSv1.2' || ssl.checkServerIdentity !== undefined) {
    fail('TLS verification was not enabled')
  }

  return {
    connectionString,
    ssl,
    summary: {
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2',
      servername,
      checkServerIdentity: 'default',
      caSource: ca.source,
      caSha256: ca.sha256,
      host,
      port,
      database,
      user,
    },
  }
}
