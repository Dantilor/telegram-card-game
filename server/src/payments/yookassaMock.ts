/** Local WEB E2E only — never on production / staging / Timeweb. */
export function yookassaMockEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.YOOKASSA_MOCK !== '1' && env.YOOKASSA_MOCK !== 'true') return false
  if (env.NODE_ENV === 'production') return false
  if (env.GNH_PRODUCTION === '1' || env.GNH_PRODUCTION === 'true') return false
  if (env.GNH_STAGING === '1' || env.GNH_STAGING === 'true') return false
  if (env.TIMEWEB === '1' || env.TIMEWEB === 'true') return false
  if (env.RENDER === 'true' || Boolean(env.RENDER_EXTERNAL_URL)) return false
  return true
}
