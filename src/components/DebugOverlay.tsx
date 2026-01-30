import { useState, useEffect } from 'react'

const MAX_LOGS = 20

declare global {
  interface Window {
    __DEBUG_LOGS__?: Array<{ type: 'log' | 'error'; args: unknown[]; ts: number }>
    __DEBUG_ERRORS__?: Array<{ message: string; stack?: string; ts: number }>
  }
}

function isInTelegram(): boolean {
  if (typeof window === 'undefined') return false
  return !!(window as any)?.Telegram?.WebApp
}

export default function DebugOverlay() {
  const [, setTick] = useState(0)
  const [inTg, setInTg] = useState(false)

  useEffect(() => {
    const check = () => setInTg(isInTelegram())
    check()
    const t = setTimeout(check, 500)
    const onLog = () => setTick((n) => n + 1)
    window.addEventListener('tgg-debug-log', onLog)
    window.addEventListener('tgg-debug-error', onLog)
    return () => {
      clearTimeout(t)
      window.removeEventListener('tgg-debug-log', onLog)
      window.removeEventListener('tgg-debug-error', onLog)
    }
  }, [])

  if (!inTg) return null

  const logs = window.__DEBUG_LOGS__ ?? []
  const errors = window.__DEBUG_ERRORS__ ?? []
  const lastLogs = logs.slice(-MAX_LOGS)
  const url = typeof window !== 'undefined' ? window.location.href : ''
  const hash = typeof window !== 'undefined' ? window.location.hash : ''
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        maxHeight: '40vh',
        overflow: 'auto',
        background: 'rgba(0,0,0,0.9)',
        color: '#0f0',
        fontSize: 10,
        fontFamily: 'monospace',
        padding: 6,
        zIndex: 99999,
        borderTop: '1px solid #333',
      }}
    >
      <div style={{ marginBottom: 4 }}>
        <strong>BOOT OK</strong> | url: {url} | hash: {hash || '(empty)'}
      </div>
      <div style={{ marginBottom: 4 }}>ua: {ua.slice(0, 80)}{ua.length > 80 ? '…' : ''}</div>
      {errors.length > 0 && (
        <div style={{ marginBottom: 4, color: '#f88' }}>
          <strong>Errors:</strong>
          {errors.slice(-5).map((e, i) => (
            <div key={i}>
              {e.message} {e.stack ? `\n${e.stack.slice(0, 200)}` : ''}
            </div>
          ))}
        </div>
      )}
      <div>
        <strong>Logs (last {MAX_LOGS}):</strong>
        {lastLogs.map((l, i) => (
          <div key={i} style={{ color: l.type === 'error' ? '#f88' : '#ccc' }}>
            [{l.type}] {String(l.args[0])}
          </div>
        ))}
      </div>
    </div>
  )
}
