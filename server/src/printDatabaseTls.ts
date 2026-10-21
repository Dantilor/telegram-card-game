import { resolvePgPoolConfig } from './dbTls.js'

// Prints only the non-secret TLS summary. It does not open a database connection.
const resolved = resolvePgPoolConfig(process.env)
process.stdout.write(`${JSON.stringify(resolved.summary)}\n`)
