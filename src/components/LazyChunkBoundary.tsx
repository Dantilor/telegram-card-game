import { Component, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type BoundaryProps = {
  children: ReactNode
  /** Increment / change to clear a captured error after recreating the lazy factory. */
  resetKey: number | string
  fallback: (retry: () => void) => ReactNode
  onError?: (error: unknown) => void
}

type BoundaryState = { hasError: boolean }

/**
 * Suspense catches pending lazy Promises; this boundary catches rejected chunk loads.
 * Pair with a remount (`resetKey`) that rebuilds `React.lazy(...)` so retry is real.
 */
export class LazyChunkErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { hasError: false }

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: unknown): void {
    this.props.onError?.(error)
  }

  componentDidUpdate(prev: BoundaryProps): void {
    if (prev.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false })
    }
  }

  private retry = (): void => {
    this.setState({ hasError: false })
  }

  render() {
    if (this.state.hasError) return this.props.fallback(this.retry)
    return this.props.children
  }
}

type ShellProps = {
  title: string
  message: string
  onRetry: () => void
  onClose?: () => void
  /** When true, backdrop/close cannot dismiss — used for required consent. */
  blocking?: boolean
  busy?: boolean
}

const shellCardStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  width: 'min(22rem, calc(100% - 2rem))',
  padding: '1.1rem 1.25rem',
  borderRadius: '1rem',
  background: 'rgba(20, 22, 36, 0.96)',
  color: '#f5f5f7',
  font: '600 0.95rem Manrope, system-ui, sans-serif',
  textAlign: 'center',
  boxSizing: 'border-box',
}

export function LazyChunkStatusShell({
  title,
  message,
  onRetry,
  onClose,
  blocking = false,
  busy = false,
}: ShellProps) {
  return createPortal(
    <div
      className="lazy-chunk-shell"
      role="dialog"
      aria-modal="true"
      aria-busy={busy || undefined}
      aria-label={title}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(8, 10, 20, 0.55)',
        padding: '1rem',
        boxSizing: 'border-box',
      }}
    >
      {!blocking && onClose ? (
        <button
          type="button"
          aria-label="Закрыть"
          onClick={onClose}
          style={{
            position: 'absolute',
            inset: 0,
            border: 0,
            background: 'transparent',
            cursor: 'pointer',
          }}
        />
      ) : null}
      <div style={shellCardStyle}>
        <p style={{ margin: '0 0 0.75rem', fontWeight: 700 }}>{title}</p>
        <p style={{ margin: '0 0 1rem', fontWeight: 500, opacity: 0.9, lineHeight: 1.4 }}>{message}</p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onRetry}
            style={{
              border: 0,
              borderRadius: '0.75rem',
              padding: '0.55rem 1rem',
              background: '#6c5ce7',
              color: '#fff',
              font: 'inherit',
              cursor: 'pointer',
            }}
          >
            Повторить
          </button>
          {!blocking && onClose ? (
            <button
              type="button"
              onClick={onClose}
              style={{
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: '0.75rem',
                padding: '0.55rem 1rem',
                background: 'transparent',
                color: '#fff',
                font: 'inherit',
                cursor: 'pointer',
              }}
            >
              Закрыть
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function LazyChunkLoadingShell({
  title,
  message,
  onClose,
  blocking = false,
}: {
  title: string
  message: string
  onClose?: () => void
  blocking?: boolean
}) {
  return createPortal(
    <div
      className="lazy-chunk-shell lazy-chunk-shell--loading"
      role="dialog"
      aria-modal="true"
      aria-busy="true"
      aria-label={title}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: blocking ? 'flex-end' : 'center',
        justifyContent: 'center',
        background: 'rgba(8, 10, 20, 0.55)',
        padding: '1rem',
        boxSizing: 'border-box',
      }}
    >
      {!blocking && onClose ? (
        <button
          type="button"
          aria-label="Закрыть"
          onClick={onClose}
          style={{
            position: 'absolute',
            inset: 0,
            border: 0,
            background: 'transparent',
            cursor: 'pointer',
          }}
        />
      ) : null}
      <div
        style={{
          ...shellCardStyle,
          ...(blocking
            ? {
                width: '100%',
                maxWidth: '28rem',
                margin: 0,
                borderRadius: '1.25rem 1.25rem 0 0',
                paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))',
              }
            : null),
        }}
      >
        {message}
      </div>
    </div>,
    document.body,
  )
}
