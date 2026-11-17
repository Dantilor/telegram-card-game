import type { NextFunction, Request, Response } from 'express'

/**
 * Lightweight request timing. Enabled with GNH_REQUEST_TIMING=1.
 * Logs method/path/status/ms only — never bodies, initData, or tokens.
 */
export function requestTimingEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = (env.GNH_REQUEST_TIMING || '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

export function attachRequestTiming(req: Request, res: Response, next: NextFunction): void {
  if (!requestTimingEnabled()) {
    next()
    return
  }
  const started = process.hrtime.bigint()
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6
    const path = (req.originalUrl || req.url || '').split('?')[0]
    // Avoid logging query strings — they may contain initData in misconfigured clients.
    console.log('[timing]', {
      method: req.method,
      path,
      status: res.statusCode,
      ms: Math.round(ms),
    })
  })
  next()
}

export function sqlTimingLog(label: string, sqlMs: number, extra?: Record<string, unknown>): void {
  if (!requestTimingEnabled()) return
  console.log('[timing:sql]', {
    label,
    sqlMs: Math.round(sqlMs),
    ...extra,
  })
}
