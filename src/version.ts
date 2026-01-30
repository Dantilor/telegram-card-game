declare const __BUILD_TIME__: string | undefined

/** Set at build time by Vite define; use for cache-busting and debug overlay */
export const APP_VERSION = __BUILD_TIME__ ?? 'dev'
