import crypto from 'node:crypto'

/** URL-safe random token (not a secret to log). */
export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url')
}

/** Cryptographically strong decimal OTP (default 8 digits). */
export function randomNumericCode(digits = 8): string {
  if (digits < 6 || digits > 12) throw new Error('otp_digits_out_of_range')
  const min = 10 ** (digits - 1)
  const max = 10 ** digits
  return String(crypto.randomInt(min, max))
}

/** SHA-256 hex digest for durable storage (never store raw session tokens). */
export function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex')
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  if (a.length !== b.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
  } catch {
    return false
  }
}

/** PKCE S256: BASE64URL(SHA256(verifier)). */
export function pkceChallengeS256(verifier: string): string {
  return crypto.createHash('sha256').update(verifier, 'ascii').digest('base64url')
}
