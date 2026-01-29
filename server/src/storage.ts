import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const STORAGE_PATH = join(__dirname, '..', 'storage.json')

export type StoredUser = {
  premium: boolean
  premiumUntil?: string // ISO date
}

export type Storage = {
  users: Record<string, StoredUser>
}

function load(): Storage {
  try {
    const raw = readFileSync(STORAGE_PATH, 'utf-8')
    return JSON.parse(raw) as Storage
  } catch {
    return { users: {} }
  }
}

function save(data: Storage): void {
  writeFileSync(STORAGE_PATH, JSON.stringify(data, null, 2), 'utf-8')
}

export function getUser(telegramId: number): StoredUser | undefined {
  const data = load()
  return data.users[String(telegramId)]
}

export function setUserPremium(telegramId: number, until: string): void {
  const data = load()
  data.users[String(telegramId)] = { premium: true, premiumUntil: until }
  save(data)
}

export function isPremium(telegramId: number): boolean {
  const u = getUser(telegramId)
  if (!u?.premium) return false
  if (!u.premiumUntil) return true
  return new Date(u.premiumUntil) > new Date()
}
