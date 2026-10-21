import type { Queryable } from './types.js'

export const DELETE_EXPIRED_ANALYTICS_SQL = `DELETE FROM events
WHERE created_at < (
  ((timezone('Europe/Moscow', now()))::date - 90)::timestamp
  AT TIME ZONE 'Europe/Moscow'
)
RETURNING id`

export async function deleteExpiredAnalytics(queryable: Queryable): Promise<number> {
  const result = await queryable.query<{ id: string | number }>(DELETE_EXPIRED_ANALYTICS_SQL)
  return result.rows.length
}
