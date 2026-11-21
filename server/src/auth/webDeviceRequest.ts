import type { Request, Response } from 'express'
import { DEVICE_COOKIE, setDeviceCookie, readCookies } from './cookies.js'
import { mintDeviceToken, hashDeviceToken } from './webTelegramDevices.js'

export function readDeviceToken(req: Request): string {
  const cookies = readCookies(req)
  const raw = cookies[DEVICE_COOKIE]
  return typeof raw === 'string' ? raw.trim() : ''
}

export function readDeviceTokenHash(req: Request): string | null {
  const token = readDeviceToken(req)
  if (!token) return null
  return hashDeviceToken(token)
}

export function ensureDeviceToken(req: Request, res: Response): string {
  const existing = readDeviceToken(req)
  if (existing) return existing
  const minted = mintDeviceToken()
  setDeviceCookie(res, minted)
  return minted
}