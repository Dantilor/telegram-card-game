import { pool } from '../db.js'
import type { Queryable, TransactionRunner } from './types.js'

export const db: Queryable = {
  async query<T>(sql: string, params?: unknown[]) {
    const result = await pool.query(sql, params)
    return { rows: result.rows as T[] }
  },
}

export const withTransaction: TransactionRunner = async (fn) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const queryable: Queryable = {
      async query<T>(sql: string, params?: unknown[]) {
        const result = await client.query(sql, params)
        return { rows: result.rows as T[] }
      },
    }
    const result = await fn(queryable)
    await client.query('COMMIT')
    return result
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {
      // The original error is the one the caller needs.
    }
    throw error
  } finally {
    client.release()
  }
}
