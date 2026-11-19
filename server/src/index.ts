import dns from 'node:dns'
dns.setDefaultResultOrder('ipv4first')

// Load env before any module that constructs the pg pool (db.ts runs at import time).
import 'dotenv/config'
import {
  logStagingDatabaseUrlFormat,
  normalizeDatabaseUrlInput,
  stagingDatabaseUrlRemediation,
} from './databaseUrlFormat.js'
import { isStagingRuntime } from './config/runtimeFlags.js'

if (isStagingRuntime()) {
  const raw = process.env.DATABASE_URL
  const { value, report } = normalizeDatabaseUrlInput(raw ?? '')
  // Diagnostics before pool init — never logs URL/password/PEM.
  logStagingDatabaseUrlFormat(report)
  if (report.normalized && value) {
    process.env.DATABASE_URL = value
    console.log('[DB] staging url_format applied safe normalize before pool init (value not logged)')
  }
  if (!report.present) {
    console.error('[DB] DATABASE_URL is required in staging')
    for (const tip of stagingDatabaseUrlRemediation(report)) {
      console.error('[DB] staging url_format_hint', tip)
    }
    process.exit(1)
  }
  if (report.issues.includes('embedded_newline') || !value || value.includes('\r') || value.includes('\n')) {
    for (const tip of stagingDatabaseUrlRemediation(report)) {
      console.error('[DB] staging url_format_hint', tip)
    }
    console.error('[DB] DATABASE_URL contains an embedded newline (value not logged)')
    process.exit(1)
  }
  if (!report.nodeUrlParseOk) {
    for (const tip of stagingDatabaseUrlRemediation(report)) {
      console.error('[DB] staging url_format_hint', tip)
    }
    console.error('[DB] DATABASE_URL could not be parsed (value not logged)')
    process.exit(1)
  }
  if (report.protocolRecognized === false) {
    for (const tip of stagingDatabaseUrlRemediation(report)) {
      console.error('[DB] staging url_format_hint', tip)
    }
    console.error('[DB] DATABASE_URL must use the postgres protocol (value not logged)')
    process.exit(1)
  }
}

// IMPORTANT: dynamic import so ipv4first + staging URL normalize run before db.ts pool init
await import('./main.js')
