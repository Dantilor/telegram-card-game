/**
 * Explicit public Vite env keys for API base resolution.
 *
 * Never pass the whole `import.meta.env` object into helpers: Vite then
 * serializes every `VITE_*` variable (including local-only secrets like
 * `VITE_WEB_DEV_LOGIN_SECRET`) into the client bundle.
 */
export type ViteApiEnv = {
  VITE_API_URL?: string
  VITE_API_BASE?: string
  VITE_GNH_SHELL?: string
  MODE?: string
}

export function viteApiEnv(): ViteApiEnv {
  return {
    VITE_API_URL: import.meta.env.VITE_API_URL as string | undefined,
    VITE_API_BASE: import.meta.env.VITE_API_BASE as string | undefined,
    VITE_GNH_SHELL: import.meta.env.VITE_GNH_SHELL as string | undefined,
    MODE: import.meta.env.MODE as string | undefined,
  }
}
