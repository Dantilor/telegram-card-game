import { useState, useEffect } from 'react'

const MAX_LOGS = 20

declare global {
  interface Window {
    __DEBUG_LOGS__?: Array<{ type: 'log' | 'error'; args: unknown[]; ts: number }>
    __DEBUG_ERRORS__?: Array<{ message: string; stack?: string; ts: number }>
  }
}

export default function DebugOverlay() {
  const [, setTick] = useState(0)

  useEffect(() => {
    const onLog = () => setTick((n) => n + 1)
    window.addEventListener('tgg-debug-log', onLog)
    window.addEventListener('tgg-debug-error', onLog)
    return () => {
      window.removeEventListener('tgg-debug-log', onLog)
      window.removeEventListener('tgg-debug-error', onLog)
    }
  }, [])

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
        top: 10,
        left: 10,
        maxWidth: 520,
        zIndex: 999999,
        background: 'rgba(0,0,0,0.55)',
        color: '#fff',
        padding: 10,
        borderRadius: 10,
        fontSize: 12,
        lineHeight: 1.35,
        whiteSpace: 'pre-wrap',
        pointerEvents: 'none',
        fontFamily: 'monospace',
        overflow: 'auto',
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
