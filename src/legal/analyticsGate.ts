/**
 * Optional analytics stays off until the server reports an active consent.
 * Events attempted earlier are discarded, not replayed.
 * A localStorage flag is not an input to this decision.
 */

const missedEventNames = new Set<string>()
let transportAllowed = false
let validUntilMs: number | null = null
let initialAppOpenSent = false

export function resetAnalyticsGate(): void {
  missedEventNames.clear()
  transportAllowed = false
  validUntilMs = null
  initialAppOpenSent = false
}

export function isAnalyticsTransportAllowed(): boolean {
  return transportAllowed
}

export function discardedEventNames(): string[] {
  return [...missedEventNames]
}

export function blockAnalyticsTransport(): void {
  transportAllowed = false
  validUntilMs = null
}

export function allowAnalyticsTransport(validUntil?: string | null): void {
  const parsed = validUntil ? Date.parse(validUntil) : Number.NaN
  if (Number.isFinite(parsed) && parsed <= Date.now()) {
    transportAllowed = false
    validUntilMs = null
    missedEventNames.clear()
    return
  }
  transportAllowed = true
  validUntilMs = Number.isFinite(parsed) ? parsed : null
  missedEventNames.clear()
}

export function canSendAnalytics(name: string): boolean {
  if (transportAllowed && validUntilMs != null && Date.now() >= validUntilMs) {
    transportAllowed = false
    validUntilMs = null
  }
  if (!transportAllowed) {
    missedEventNames.add(name)
    return false
  }
  return true
}

/** True only for the first resolved server state that is already active. */
export function shouldSendInitialAppOpen(serverActive: boolean, initialResolution: boolean): boolean {
  if (!initialResolution || !serverActive || initialAppOpenSent) return false
  initialAppOpenSent = true
  return true
}

export function resolveAnalyticsTransport(serverActive: boolean, localClaim: boolean): boolean {
  void localClaim
  return serverActive
}
