import { ANALYTICS_EVENTS, isSafeIdentifier } from './constants.js'
import { hasActiveAnalyticsConsent } from './consents.js'
import { LegalError, isPgMissingRelation } from './errors.js'
import { verifyInitData } from '../telegram/verifyInitData.js'
import type { Queryable } from './types.js'

export function assessAnalyticsEvent(
  name: unknown,
  props: unknown
): { name: string; props: Record<string, string> | null } {
  if (typeof name !== 'string' || !Object.prototype.hasOwnProperty.call(ANALYTICS_EVENTS, name)) {
    throw new LegalError('invalid_event', 400, 'Событие не входит в состав необязательной аналитики.')
  }
  const spec = ANALYTICS_EVENTS[name]
  if (props == null) {
    if (spec.required.length > 0) {
      throw new LegalError('invalid_event', 400, 'Для события не хватает разрешённого идентификатора.')
    }
    return { name, props: null }
  }
  if (typeof props !== 'object' || Array.isArray(props)) {
    throw new LegalError('invalid_event', 400, 'Свойства события должны быть объектом разрешённых идентификаторов.')
  }
  const allowed = new Set([...spec.required, ...spec.optional])
  const output: Record<string, string> = {}
  for (const [key, value] of Object.entries(props)) {
    if (!allowed.has(key) || typeof value !== 'string' || !isSafeIdentifier(value)) {
      throw new LegalError('invalid_event', 400, 'Свойство события не разрешено.')
    }
    output[key] = value
  }
  for (const key of spec.required) {
    if (!output[key]) throw new LegalError('invalid_event', 400, 'Для события не хватает разрешённого идентификатора.')
  }
  return { name, props: Object.keys(output).length > 0 ? output : null }
}

export async function handleAnalyticsEvent(input: {
  query: Queryable
  botToken: string
  initData: unknown
  name: unknown
  props: unknown
}): Promise<{ status: number; body: Record<string, unknown> }> {
  if (typeof input.initData !== 'string' || input.initData.trim().length === 0) {
    return { status: 401, body: { ok: false, error: 'initData required' } }
  }
  let telegramId: number
  try {
    telegramId = verifyInitData(input.initData.trim(), input.botToken).telegram_id
  } catch {
    return { status: 401, body: { ok: false, error: 'Unauthorized' } }
  }
  let event: { name: string; props: Record<string, string> | null }
  try {
    event = assessAnalyticsEvent(input.name, input.props)
  } catch (error) {
    if (error instanceof LegalError) return { status: error.status, body: { ok: false, error: error.code, message: error.message } }
    throw error
  }
  try {
    const allowed = await hasActiveAnalyticsConsent(input.query, telegramId)
    if (!allowed) {
      return {
        status: 403,
        body: {
          ok: false,
          error: 'analytics_consent_required',
          message: 'Необязательная аналитика не записана: нет действующего согласия.',
        },
      }
    }
    await input.query.query(
      `INSERT INTO events (telegram_id, event_name, event_props) VALUES ($1::bigint, $2, $3::jsonb)`,
      [telegramId, event.name, event.props ? JSON.stringify(event.props) : null]
    )
    return { status: 200, body: { ok: true } }
  } catch (error) {
    if (isPgMissingRelation(error)) {
      return {
        status: 503,
        body: {
          ok: false,
          error: 'legal_storage_unavailable',
          message: 'Необязательная аналитика не записана: учёт согласия недоступен.',
        },
      }
    }
    throw error
  }
}
