import crypto from 'node:crypto'

export function sha256Utf8(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex')
}

export function sha256Buffer(bytes: Buffer): string {
  return crypto.createHash('sha256').update(bytes).digest('hex')
}

export function sameHash(left: string, right: string): boolean {
  if (left.length !== right.length || left.length === 0) return false
  return crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right))
}
