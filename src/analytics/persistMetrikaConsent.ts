import { csrfHeadersForMutation } from '../lib/csrf'
import { ensureWebSession } from '../lib/webAuth'
import { viteApiEnv } from '../lib/vitePublicEnv'
import { legalApiBase, newRequestId } from '../legal/client'
import {
  METRIKA_CONSENT_STATEMENT,
  METRIKA_CONSENT_UI_VERSION,
} from './metrikaConsentConstants'

export type MetrikaConsentAction = 'grant' | 'decline' | 'withdraw'

/**
 * Persist Metrika consent/refusal/withdraw on the server before loading tag.js.
 * Fail-closed: returns false if the evidence row cannot be stored.
 */
export async function persistMetrikaConsentEvidence(action: MetrikaConsentAction): Promise<boolean> {
  try {
    const session = await ensureWebSession()
    if (!session?.webAccountId) return false
    const base = legalApiBase(viteApiEnv())
    const res = await fetch(`${base}/api/legal/metrika-consent`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...csrfHeadersForMutation('POST'),
      },
      body: JSON.stringify({
        action,
        requestId: newRequestId(),
        consentUiVersion: METRIKA_CONSENT_UI_VERSION,
        ...(action === 'grant' ? { statement: METRIKA_CONSENT_STATEMENT } : {}),
      }),
    })
    return res.status === 201
  } catch {
    return false
  }
}