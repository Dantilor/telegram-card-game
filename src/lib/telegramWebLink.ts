import { resolveApiBase } from './apiBase'
import { getInitData } from './telegram'
import { waitForInitData } from './waitForInitData'

function apiBase(): string {
  return resolveApiBase({
    VITE_API_URL: import.meta.env.VITE_API_URL,
    VITE_API_BASE: import.meta.env.VITE_API_BASE,
  })
}

export async function completeTelegramWebLink(token: string): Promise<{
  ok: boolean
  linked?: boolean
  isPremium?: boolean
  premium?: boolean
  activeUntil?: string | null
  sources?: string[]
  devicesUsed?: number
  devicesLimit?: number
}> {
  const initData = getInitData() || (await waitForInitData(3500))
  if (!initData) {
    const err = new Error('telegram_init_required') as Error & { status?: number; code?: string }
    err.status = 401
    err.code = 'telegram_init_required'
    throw err
  }
  const res = await fetch(`${apiBase()}/api/web/telegram-link/complete`, {
    method: 'POST',
    credentials: 'omit',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-telegram-init-data': initData,
    },
    body: JSON.stringify({ token: token.trim() }),
  })
  if (!res.ok) {
    const err = new Error('telegram_link_complete_failed') as Error & {
      status?: number
      code?: string
      devicesUsed?: number
      devicesLimit?: number
    }
    err.status = res.status
    try {
      const body = (await res.json()) as {
        code?: string
        devicesUsed?: number
        devicesLimit?: number
      }
      if (typeof body.code === 'string') err.code = body.code
      if (typeof body.devicesUsed === 'number') err.devicesUsed = body.devicesUsed
      if (typeof body.devicesLimit === 'number') err.devicesLimit = body.devicesLimit
    } catch {
      /* ignore */
    }
    if (!err.code && res.status === 401) err.code = 'telegram_init_required'
    throw err
  }
  return (await res.json()) as {
    ok: boolean
    linked?: boolean
    isPremium?: boolean
    premium?: boolean
    activeUntil?: string | null
    sources?: string[]
    devicesUsed?: number
    devicesLimit?: number
  }
}

export async function fetchTelegramDevicesForMiniApp(): Promise<{
  devices: Array<{
    id: string
    label: string
    linkedAt: string
    lastActiveAt: string
    isCurrent: boolean
  }>
  devicesUsed: number
  devicesLimit: number
}> {
  const initData = getInitData() || (await waitForInitData(3500))
  if (!initData) throw new Error('telegram_init_required')
  const res = await fetch(`${apiBase()}/api/web/telegram-devices/telegram`, {
    method: 'GET',
    credentials: 'omit',
    headers: {
      Accept: 'application/json',
      'x-telegram-init-data': initData,
    },
  })
  if (!res.ok) throw new Error('devices_list_failed')
  const body = (await res.json()) as {
    devices: Array<{
      id: string
      label: string
      linkedAt: string
      lastActiveAt: string
      isCurrent: boolean
    }>
    devicesUsed: number
    devicesLimit: number
  }
  return body
}

export async function revokeTelegramDeviceFromMiniApp(deviceId: string): Promise<{
  devicesUsed: number
  devicesLimit: number
  devices: Array<{ id: string; label: string; linkedAt: string; lastActiveAt: string; isCurrent: boolean }>
}> {
  const initData = getInitData() || (await waitForInitData(3500))
  if (!initData) throw new Error('telegram_init_required')
  const res = await fetch(`${apiBase()}/api/web/telegram-devices/revoke`, {
    method: 'POST',
    credentials: 'omit',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-telegram-init-data': initData,
    },
    body: JSON.stringify({ deviceId }),
  })
  if (!res.ok) throw new Error('device_revoke_failed')
  return (await res.json()) as {
    devicesUsed: number
    devicesLimit: number
    devices: Array<{ id: string; label: string; linkedAt: string; lastActiveAt: string; isCurrent: boolean }>
  }
}