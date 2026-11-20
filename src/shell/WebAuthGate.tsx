import { type ReactNode } from 'react'
import { WebSessionProvider } from './WebSessionContext'
import './WebAuthGate.css'

/**
 * WEB bootstrap: anonymous account cookie, no mandatory login.
 * Session resolves in the background; children paint immediately.
 */
export function WebAuthGate({ children }: { children: ReactNode }) {
  return <WebSessionProvider>{children}</WebSessionProvider>
}
