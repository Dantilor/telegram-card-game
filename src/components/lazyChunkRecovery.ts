/**
 * Soft retry may fail forever when a hashed Vite chunk 404s after deploy.
 * Reuse the game chunk recovery path: one guarded reload that keeps the
 * Telegram hash/launch params and never retries payment POSTs.
 */
import {
  isChunkLoadError,
  recoverMissingGameChunk,
  showChunkRecoveryNotice,
} from '../lib/chunkRecovery'

export { isChunkLoadError }

/** Soft in-app retry first; for stale 404s offer a guarded document reload. */
export function safeReloadForStaleLazyChunk(): boolean {
  if (recoverMissingGameChunk()) return true
  showChunkRecoveryNotice()
  return false
}
