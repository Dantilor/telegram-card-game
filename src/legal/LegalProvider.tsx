import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { LegalDocumentModal } from '../components/LegalDocumentView'
import { blockAnalyticsTransport } from './analyticsGate'
import { LegalClientError, legalApiBase } from './client'
import { preloadDocuments } from './documentCache'
import { PROFILE_DOCUMENTS } from './catalog'
import { getInitData } from '../lib/telegram'
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

async function requestLegal(
  path: string,
  method: 'GET' | 'POST',
  body?: Record<string, unknown>
): Promise<unknown> {
  const base = legalApiBase(import.meta.env)
  const initData = getInitData()
  if (!initData) {
    throw new LegalClientError('auth_required', 401, 'Откройте приложение внутри Telegram.')
  }
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'x-telegram-init-data': initData,
  }
  if (body) headers['Content-Type'] = 'application/json'
  let response: Response
  try {
    response = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'omit',
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
    // Collection is disabled in this product flow, including older grants.
    blockAnalyticsTransport()
    if (!getInitData()) {
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
      setStatus('error')
      setError(reason instanceof LegalClientError ? reason.message : 'Не удалось проверить согласия.')
    }
  }, [])

  useEffect(() => {
    preloadDocuments(PROFILE_DOCUMENTS.map((document) => document.id))
    void refreshRecords()
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
