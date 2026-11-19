/**
 * Safe DATABASE_URL shape checks / mild normalization.
 * Never returns or logs the raw URL, password, tokens, or PEM.
 */

export type DatabaseUrlFormatReport = {
  present: boolean
  protocolRecognized: boolean | null
  hasCr: boolean
  hasLf: boolean
  hasWrappingQuotes: boolean
  hasEnvAssignmentPrefix: boolean
  hasEdgeWhitespace: boolean
  nodeUrlParseOk: boolean
  /** True when mild formatting fixes were applied (trim / quotes / prefix). */
  normalized: boolean
  issues: string[]
}

const ENV_PREFIX_RE = /^DATABASE_URL\s*=\s*/i

function isStagingEnv(env: NodeJS.ProcessEnv): boolean {
  return (
    env.GNH_STAGING === '1' ||
    env.GNH_STAGING === 'true' ||
    env.GNH_ENV === 'staging'
  )
}

export function inspectDatabaseUrlFormat(raw: string | undefined | null): DatabaseUrlFormatReport {
  if (raw === undefined || raw === null || raw === '') {
    return {
      present: false,
      protocolRecognized: null,
      hasCr: false,
      hasLf: false,
      hasWrappingQuotes: false,
      hasEnvAssignmentPrefix: false,
      hasEdgeWhitespace: false,
      nodeUrlParseOk: false,
      normalized: false,
      issues: ['missing'],
    }
  }

  const hasCr = raw.includes('\r')
  const hasLf = raw.includes('\n')
  const hasEdgeWhitespace = raw.trim() !== raw
  const trimmed = raw.trim()
  const hasEnvAssignmentPrefix = ENV_PREFIX_RE.test(trimmed)
  const afterPrefix = hasEnvAssignmentPrefix ? trimmed.replace(ENV_PREFIX_RE, '') : trimmed
  const hasWrappingQuotes =
    (afterPrefix.startsWith('"') && afterPrefix.endsWith('"') && afterPrefix.length >= 2) ||
    (afterPrefix.startsWith("'") && afterPrefix.endsWith("'") && afterPrefix.length >= 2)

  let candidate = afterPrefix
  if (hasWrappingQuotes) candidate = candidate.slice(1, -1).trim()

  const normalized =
    hasEdgeWhitespace || hasEnvAssignmentPrefix || hasWrappingQuotes || candidate !== raw

  let protocolRecognized: boolean | null = null
  let nodeUrlParseOk = false
  try {
    const u = new URL(candidate)
    nodeUrlParseOk = true
    protocolRecognized = u.protocol === 'postgres:' || u.protocol === 'postgresql:'
  } catch {
    nodeUrlParseOk = false
    protocolRecognized = null
  }

  const issues: string[] = []
  if (hasCr) issues.push('contains_cr')
  if (hasLf) issues.push('contains_lf')
  if (hasWrappingQuotes) issues.push('wrapping_quotes')
  if (hasEnvAssignmentPrefix) issues.push('env_assignment_prefix')
  if (hasEdgeWhitespace) issues.push('edge_whitespace')
  if (!nodeUrlParseOk) issues.push('node_url_parse_failed')
  if (nodeUrlParseOk && protocolRecognized === false) issues.push('protocol_not_postgres')
  if (candidate.includes('\r') || candidate.includes('\n')) issues.push('embedded_newline')

  return {
    present: true,
    protocolRecognized,
    hasCr,
    hasLf,
    hasWrappingQuotes,
    hasEnvAssignmentPrefix,
    hasEdgeWhitespace,
    nodeUrlParseOk,
    normalized,
    issues,
  }
}

/**
 * Apply only safe, non-secret formatting fixes used by Timeweb/panel paste mistakes.
 * Does not weaken TLS. Refuses embedded (mid-value) CR/LF after trim.
 */
export function normalizeDatabaseUrlInput(raw: string): {
  value: string
  report: DatabaseUrlFormatReport
} {
  const originalReport = inspectDatabaseUrlFormat(raw)
  if (!raw || raw.trim() === '') {
    return { value: '', report: originalReport }
  }

  let value = raw.trim()
  if (ENV_PREFIX_RE.test(value)) {
    value = value.replace(ENV_PREFIX_RE, '')
  }
  if (
    (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
    (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
  ) {
    value = value.slice(1, -1).trim()
  }

  const after = inspectDatabaseUrlFormat(value)
  return {
    value,
    report: {
      ...after,
      // Keep original paste-shape flags so staging logs explain what Timeweb stored.
      hasCr: originalReport.hasCr,
      hasLf: originalReport.hasLf,
      hasWrappingQuotes: originalReport.hasWrappingQuotes,
      hasEnvAssignmentPrefix: originalReport.hasEnvAssignmentPrefix,
      hasEdgeWhitespace: originalReport.hasEdgeWhitespace,
      normalized: originalReport.normalized,
      issues: [...new Set([...originalReport.issues, ...after.issues])].filter((issue) => {
        // After successful normalize, drop parse/protocol failures that are fixed.
        if (after.nodeUrlParseOk && issue === 'node_url_parse_failed') return false
        if (after.protocolRecognized && issue === 'protocol_not_postgres') return false
        if (!after.hasCr && !after.hasLf && (issue === 'contains_cr' || issue === 'contains_lf')) {
          // Keep original contains_* for diagnostics; do not filter those.
          return true
        }
        if (issue === 'embedded_newline' && !value.includes('\r') && !value.includes('\n')) {
          return false
        }
        return true
      }),
    },
  }
}

/** Staging-only safe log line — never includes URL/password/PEM. */
export function logStagingDatabaseUrlFormat(
  report: DatabaseUrlFormatReport,
  env: NodeJS.ProcessEnv = process.env,
  log: (line: string) => void = console.log
): void {
  if (!isStagingEnv(env)) return
  const flags = [
    `present=${report.present ? 1 : 0}`,
    `protocol=${report.protocolRecognized === null ? 'n/a' : report.protocolRecognized ? 'postgres' : 'other'}`,
    `cr=${report.hasCr ? 1 : 0}`,
    `lf=${report.hasLf ? 1 : 0}`,
    `wrapping_quotes=${report.hasWrappingQuotes ? 1 : 0}`,
    `env_prefix=${report.hasEnvAssignmentPrefix ? 1 : 0}`,
    `edge_ws=${report.hasEdgeWhitespace ? 1 : 0}`,
    `node_parse=${report.nodeUrlParseOk ? 1 : 0}`,
    `normalized=${report.normalized ? 1 : 0}`,
  ].join(' ')
  log(`[DB] staging url_format ${flags}`)
  if (report.issues.length) {
    log(`[DB] staging url_format_issues ${report.issues.join(',')}`)
  }
}

export function stagingDatabaseUrlRemediation(report: DatabaseUrlFormatReport): string[] {
  const tips: string[] = []
  if (!report.present) {
    tips.push('Set DATABASE_URL on the Timeweb Stand (gnh_web_staging only; never gnh_supabase).')
    return tips
  }
  if (report.hasCr || report.hasLf || report.hasEdgeWhitespace) {
    tips.push(
      'Remove CR/LF and leading/trailing spaces from the DATABASE_URL value in Timeweb env (paste as a single line).'
    )
  }
  if (report.hasWrappingQuotes) {
    tips.push('Remove wrapping single/double quotes around DATABASE_URL in Timeweb env.')
  }
  if (report.hasEnvAssignmentPrefix) {
    tips.push('Store only the URL value, not a line like DATABASE_URL=postgresql://…')
  }
  if (!report.nodeUrlParseOk) {
    tips.push(
      'URL-encode special characters in the password (e.g. @ → %40, / → %2F, # → %23) using a local PowerShell EscapeDataString check; do not paste the password into logs.'
    )
  }
  if (report.protocolRecognized === false) {
    tips.push('DATABASE_URL must start with postgresql:// or postgres://')
  }
  if (report.issues.includes('embedded_newline')) {
    tips.push('DATABASE_URL contains a newline in the middle — recreate the env var as one line.')
  }
  return tips
}
