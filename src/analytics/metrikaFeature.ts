/** Explicit opt-in release gate. Default OFF in every build. */
import { isWebShell } from '../config/shell'

export function isWebMetrikaFeatureEnabled(): boolean {
  return isWebShell() && import.meta.env.VITE_GNH_METRIKA_ENABLED === '1'
}
