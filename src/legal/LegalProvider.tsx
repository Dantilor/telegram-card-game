import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { LegalDocumentModal } from '../components/LegalDocumentView'
import { blockAnalyticsTransport } from './analyticsGate'
import { LegalClientError, legalApiBase } from './client'
import { preloadDocuments } from './documentCache'
import { PROFILE_DOCUMENTS } from './catalog'
import { getInitData } from '../lib/telegram'
import { isWebShell } from '../config/shell'
import { csrfHeadersForMutation } from '../lib/csrf'
import { afterCriticalImages, scheduleWhenIdle } from '../utils/scheduleWhenIdle'
import type { OwnLegalRecords } from './types'

type Viewer = { id: string; version?: string }

type LegalContextValue = {
  records: OwnLegalRecords | null
  status: 'loading' | 'ready' | 'anonymous' | 'error'
  error: string | null
  refreshRecords: () => Promise<void>
  openDocument: (id: string, version?: string) => void
  postLegal: (path: string, body?: Record<string, unknown>) => Promise<unknown>
}

const LegalContext = createContext<LegalContextValue | null>(null)

function hasLegalAuth(): boolean {
  if (isWebShell()) return true
  return Boolean(getInitData())
}

async function requestLegal(
  path: string,
  method: 'GET' | 'POST',
  body?: Record<string, unknown>
): Promise<unknown> {
  const base = legalApiBase(import.meta.env)
  const initData = getInitData()
  const web = isWebShell()
  if (!web && !initData) {
    throw new LegalClientError('auth_required', 401, 'Откройте приложение внутри Telegram.')
  }
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...csrfHeadersForMutation(method),
  }
  if (!web && initData) {
    headers['x-telegram-init-data'] = initData
  }
  if (body) headers['Content-Type'] = 'application/json'
  let response: Response
  try {
    response = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: web ? 'include' : 'omit',
    })
  } catch {
    throw new LegalClientError('network', 0, 'Нет соединения. Подтверждение не сохранено.')
  }
  const text = await response.text()
  if (!response.ok) {
    let message = 'Запрос не выполнен. Подтверждение не сохранено.'
    let code = `http_${response.status}`
    if (text && text.length < 500 && !/initData|auth_date/i.test(text)) {
      try {
        const parsed = JSON.parse(text) as { message?: unknown; error?: unknown }
        if (typeof parsed.message === 'string' && parsed.message.trim()) message = parsed.message.trim()
        if (typeof parsed.error === 'string' && /^[a-z0-9_]+$/.test(parsed.error)) code = parsed.error
      } catch {
        message = 'Запрос не выполнен. Подтверждение не сохранено.'
      }
    }
    throw new LegalClientError(code, response.status, message)
  }
  if (!text) return {}
  return JSON.parse(text) as unknown
}

export function LegalProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<OwnLegalRecords | null>(null)
  const [status, setStatus] = useState<LegalContextValue['status']>('loading')
  const [error, setError] = useState<string | null>(null)
  const [viewer, setViewer] = useState<Viewer | null>(null)

  const refreshRecords = useCallback(async () => {
    blockAnalyticsTransport()
    if (!hasLegalAuth()) {
      blockAnalyticsTransport()
      setRecords(null)
      setStatus('anonymous')
      setError(null)
      return
    }
    try {
      const data = (await requestLegal('/api/legal/me', 'GET')) as OwnLegalRecords
      setRecords(data)
      setStatus('ready')
      setError(null)
    } catch (reason) {
      blockAnalyticsTransport()
      if (reason instanceof LegalClientError && reason.status === 401 && isWebShell()) {
        setRecords(null)
        setStatus('anonymous')
        setError(null)
        return
      }
      setStatus('error')
      setError(reason instanceof LegalClientError ? reason.message : 'Не удалось проверить согласия.')
    }
  }, [])

  useEffect(() => {
    void refreshRecords()
    // Тексты документов не нужны для первого кадра Home: сначала hero, затем idle.
    let cancelIdle: (() => void) | null = null
    const cancelWait = afterCriticalImages(() => {
      cancelIdle = scheduleWhenIdle(() => preloadDocuments(PROFILE_DOCUMENTS.map((document) => document.id)), 5000)
    })
    return () => {
      cancelWait()
      cancelIdle?.()
    }
  }, [refreshRecords])

  const openDocument = useCallback((id: string, version?: string) => setViewer({ id, version }), [])
  const closeDocument = useCallback(() => setViewer(null), [])

  const value = useMemo<LegalContextValue>(
    () => ({
      records,
      status,
      error,
      refreshRecords,
      openDocument,
      postLegal: (path, body) => requestLegal(path, 'POST', body),
    }),
    [records, status, error, refreshRecords, openDocument]
  )

  return (
    <LegalContext.Provider value={value}>
      {children}
      {viewer && (
        <LegalDocumentModal
          key={`${viewer.id}:${viewer.version ?? 'active'}`}
          documentId={viewer.id}
          version={viewer.version}
          onClose={closeDocument}
        />
      )}
    </LegalContext.Provider>
  )
}

export function useLegal(): LegalContextValue {
  const value = useContext(LegalContext)
  if (!value) throw new Error('useLegal requires LegalProvider')
  return value
}
