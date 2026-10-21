export class LegalError extends Error {
  readonly status: number
  readonly code: string

  constructor(code: string, status: number, message: string) {
    super(message)
    this.name = 'LegalError'
    this.code = code
    this.status = status
  }
}

export function legalErrorBody(error: LegalError): { error: string; message: string } {
  return { error: error.code, message: error.message }
}

export function isPgMissingRelation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '42P01'
}

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23505'
}
